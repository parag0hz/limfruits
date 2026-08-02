import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';
import { normalizePhone } from '@/lib/format';

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

  const amount = option.price * quantity;
  const orderName =
    quantity === 1 ? option.name : `${option.name} x ${quantity}`;

  const order = await store.createOrder({
    items: [
      {
        optionId: option.id,
        optionName: option.name,
        unitPrice: option.price,
        quantity,
      },
    ],
    totalAmount: amount,
    customerName,
    phone,
    postcode,
    address1,
    address2,
    memo,
  });

  return NextResponse.json({
    orderNo: order.orderNo,
    amount: order.totalAmount,
    orderName,
  });
}
