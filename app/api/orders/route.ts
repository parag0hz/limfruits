import { NextResponse } from 'next/server';
import { BenefitReservationError, getStore } from '@/lib/db';
import { earnedPointsFor, resolveBenefits } from '@/lib/coupon-points';
import { normalizePhone } from '@/lib/format';
import { getUserSession } from '@/lib/user-auth';

export const runtime = 'nodejs';

const MAX_QUANTITY = 20;

interface CreateOrderBody {
  optionId?: unknown;
  quantity?: unknown;
  customerName?: unknown;
  phone?: unknown;
  postcode?: unknown;
  address1?: unknown;
  address2?: unknown;
  memo?: unknown;
  marketingConsent?: unknown;
  couponId?: unknown; // v2.9 — 적용할 쿠폰 id (로그인 회원)
  pointsToUse?: unknown; // v2.9 — 사용할 포인트(원)
}

function asTrimmedString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * 주문 생성: 검증 → 옵션을 DB에서 조회해 금액을 서버가 계산 → PENDING 주문 저장.
 * 응답: { orderNo, amount, orderName }
 */
export async function POST(req: Request) {
  let body: CreateOrderBody;
  try {
    body = (await req.json()) as CreateOrderBody;
  } catch {
    return badRequest('요청 형식이 올바르지 않아요. 새로고침 후 다시 시도해 주세요.');
  }

  const optionId = asTrimmedString(body.optionId);
  const customerName = asTrimmedString(body.customerName);
  const phone = normalizePhone(asTrimmedString(body.phone));
  const postcode = asTrimmedString(body.postcode);
  const address1 = asTrimmedString(body.address1);
  const address2 = asTrimmedString(body.address2);
  const memo = asTrimmedString(body.memo);
  const quantity = typeof body.quantity === 'number' ? body.quantity : NaN;
  // v2.7 — 광고성 정보 수신 동의 (선택). 명시적 true 만 동의로 취급, 기본 false.
  const marketingConsent = body.marketingConsent === true;

  if (!optionId) {
    return badRequest('상품 옵션을 선택해 주세요.');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return badRequest(`수량은 1개부터 ${MAX_QUANTITY}개까지 주문하실 수 있어요.`);
  }
  if (!customerName) {
    return badRequest('주문하시는 분의 성함을 입력해 주세요.');
  }
  if (customerName.length > 30) {
    return badRequest('성함은 30자 이내로 입력해 주세요.');
  }
  if (phone.length < 10 || phone.length > 11 || !phone.startsWith('0')) {
    return badRequest('연락처를 정확히 입력해 주세요. 예: 010-1234-5678');
  }
  if (!postcode || !address1) {
    return badRequest('주소검색으로 배송지 주소를 입력해 주세요.');
  }
  if (memo.length > 200) {
    return badRequest('배송 메모는 200자 이내로 입력해 주세요.');
  }

  const store = getStore();
  const option = await store.getOption(optionId);
  if (!option) {
    return badRequest('선택하신 상품 옵션을 찾을 수 없어요. 새로고침 후 다시 선택해 주세요.');
  }
  if (option.soldOut) {
    return badRequest('죄송해요, 선택하신 옵션은 현재 품절이에요. 다른 옵션을 선택해 주세요.', 409);
  }

  const product = await store.getProduct(option.productId);
  if (!product || !product.isActive) {
    return badRequest('지금은 판매하지 않는 상품이에요. 홈에서 다른 상품을 선택해 주세요.', 409);
  }

  const subtotal = option.price * quantity;
  // 스마트스토어식 주문명: "나주배 가정용 3kg x 2"
  const orderName = `${product.name} ${option.name} x ${quantity}`;

  // v2.8 — 로그인 세션이 있으면 userId 를 주문에 첨부(없으면 null).
  // 유저 세션은 관리자 세션과 완전 분리(lib/user-auth). 세션 조회 실패는 비회원으로 강등해
  // 결제 경로에 영향을 주지 않는다. 금액·검증 로직은 위와 동일하게 불변.
  let userId: string | null = null;
  try {
    const session = await getUserSession();
    userId = session?.userId ?? null;
  } catch {
    userId = null;
  }

  // v2.9 — 쿠폰·포인트 (로그인 회원만). **서버가 재검증·재계산**한 금액만 신뢰한다.
  // 클라이언트가 보낸 couponId/pointsToUse 는 "요청"일 뿐, 실제 할인은 resolveBenefits 가 정한다.
  const couponIdReq = asTrimmedString(body.couponId) || null;
  const pointsToUse =
    typeof body.pointsToUse === 'number' && Number.isFinite(body.pointsToUse)
      ? Math.max(0, Math.floor(body.pointsToUse))
      : 0;

  let couponIdApplied: string | null = null;
  let couponDiscount = 0;
  let pointsUsed = 0;
  let finalAmount = subtotal;

  if (userId && (couponIdReq || pointsToUse > 0)) {
    // 방치된 PENDING 주문의 쿠폰·포인트를 먼저 반환(본인 혜택 회수 → 재시도 가능)
    try {
      await store.releaseStalePendingBenefits(userId);
    } catch {
      // 반환 실패는 주문을 막지 않는다(예약 단계에서 어차피 재검증됨)
    }

    let coupon = couponIdReq ? await store.getCoupon(couponIdReq) : null;
    // 소유자 확인 — 남의 쿠폰/없는 쿠폰은 적용하지 않는다
    if (coupon && coupon.userId !== userId) coupon = null;

    const user = await store.getUser(userId);
    const balance = user?.points ?? 0;
    const resolved = resolveBenefits({
      subtotal,
      coupon,
      requestedPoints: pointsToUse,
      pointsBalance: balance,
      nowMs: Date.now(),
    });
    couponDiscount = resolved.couponDiscount;
    pointsUsed = resolved.pointsUsed;
    finalAmount = resolved.finalAmount;
    couponIdApplied = resolved.couponApplied && coupon ? coupon.id : null;
  }

  // 적립: 로그인 주문은 최종 결제액의 1%(내림). 결제완료(markPaid) 시 실제 지급.
  const pointsEarned = userId ? earnedPointsFor(finalAmount) : 0;

  let order;
  try {
    order = await store.createOrder({
      items: [
        {
          productId: product.id,
          productName: product.name,
          optionId: option.id,
          optionName: option.name,
          unitPrice: option.price,
          quantity,
        },
      ],
      totalAmount: finalAmount,
      customerName,
      phone,
      postcode,
      address1,
      address2,
      memo,
      marketingConsent,
      userId,
      couponId: couponIdApplied,
      couponDiscount,
      pointsUsed,
      pointsEarned,
    });
  } catch (err) {
    if (err instanceof BenefitReservationError) {
      // 쿠폰/포인트가 방금 다른 주문에 쓰였거나 잔액이 바뀐 경쟁 상태
      return badRequest(err.message, 409);
    }
    throw err;
  }

  return NextResponse.json({
    orderNo: order.orderNo,
    amount: order.totalAmount,
    orderName,
    // 클라이언트 표시용 — 실제 결제금액은 amount(서버 계산). 할인 내역은 참고용.
    couponDiscount: order.couponDiscount,
    pointsUsed: order.pointsUsed,
  });
}
