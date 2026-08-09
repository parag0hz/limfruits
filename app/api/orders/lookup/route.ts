import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';
import { normalizePhone } from '@/lib/format';

export const runtime = 'nodejs';

/**
 * 비회원 주문 조회: 주문번호 + 전화번호(숫자만 비교)가 모두 일치해야 반환.
 * 응답에는 paymentKey 등 내부 정보를 제외한 필드만 담는다.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderNo = (searchParams.get('orderNo') ?? '').trim().toUpperCase();
  const phone = normalizePhone(searchParams.get('phone') ?? '');

  if (!orderNo) {
    return NextResponse.json(
      { error: '주문번호를 입력해 주세요.' },
      { status: 400 }
    );
  }
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json(
      { error: '주문하실 때 입력하신 연락처를 정확히 입력해 주세요.' },
      { status: 400 }
    );
  }

  const order = await getStore().findOrder(orderNo, phone);
  if (!order) {
    return NextResponse.json(
      {
        error:
          '주문을 찾지 못했어요. 주문번호와 연락처를 다시 확인해 주세요. 계속 찾을 수 없으면 판매자에게 문의해 주세요.',
      },
      { status: 404 }
    );
  }

  // v2.2: 수령(SHIPPING/DONE) 주문이면 리뷰 작성 여부를 함께 알려준다
  // — 조회 화면이 "리뷰 쓰기 / 리뷰 작성 완료" 버튼을 바로 구분해 표시 (SPEC v2.2 부록)
  const hasReview =
    order.status === 'SHIPPING' || order.status === 'DONE'
      ? (await getStore().getReviewByOrderNo(order.orderNo)) !== null
      : false;

  // v2.4: 선물(다중배송) 주문이면 배송 건별 현황을 함께 반환한다.
  // 인증에 성공한 보내는 분(주문자)에게만 보이며, 받는 분 전화·상세주소 등은
  // 제외하고 배송 추적에 필요한 값(받는 분 성함·구성·택배사·운송장)만 노출한다.
  const shipments =
    order.kind === 'GIFT'
      ? order.shipments.map((s) => ({
          recipientName: s.recipientName,
          giftMessage: s.giftMessage,
          items: s.items,
          courier: s.courier,
          trackingNo: s.trackingNo,
        }))
      : [];

  // 조회에 필요한 정보만 골라서 반환 (paymentKey·phone 등 내부 값 제외)
  return NextResponse.json({
    order: {
      orderNo: order.orderNo,
      kind: order.kind,
      status: order.status,
      customerName: order.customerName,
      postcode: order.postcode,
      address1: order.address1,
      address2: order.address2,
      memo: order.memo,
      items: order.items,
      shipments,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt,
      courier: order.courier,
      trackingNo: order.trackingNo,
      createdAt: order.createdAt,
      hasReview,
    },
  });
}
