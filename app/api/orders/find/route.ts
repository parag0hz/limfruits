import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';
import type { Order } from '@/lib/types';
import { normalizePhone } from '@/lib/format';

export const runtime = 'nodejs';

/** "나주배 선물세트 7.5kg 외 2건" — 목록 표시용 상품 요약 */
function itemsSummary(order: Order): string {
  const items = order.items;
  if (!items.length) return '주문 상품';
  const first = items[0];
  const label = first.productName
    ? `${first.productName} ${first.optionName}`
    : first.optionName;
  return items.length > 1 ? `${label} 외 ${items.length - 1}건` : label;
}

/**
 * 비회원 주문 찾기: 성함 + 연락처(둘 다 일치)로 본인 주문 목록.
 * 주문번호를 잊었을 때 복구용. 성함+연락처는 주문번호+연락처보다 약한 인증이므로
 * 주소·메모·전화 등 민감정보는 제외하고 번호 복구·배송추적에 필요한 최소 정보만 반환한다.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get('name') ?? '').trim();
  const phone = normalizePhone(searchParams.get('phone') ?? '');

  if (!name) {
    return NextResponse.json(
      { error: '주문하실 때 입력하신 성함을 입력해 주세요.' },
      { status: 400 }
    );
  }
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json(
      { error: '주문하실 때 입력하신 연락처를 정확히 입력해 주세요.' },
      { status: 400 }
    );
  }

  const orders = await getStore().findOrdersByPhoneName(phone, name);

  const list = orders.map((o) => ({
    orderNo: o.orderNo,
    kind: o.kind,
    status: o.status,
    createdAt: o.createdAt,
    totalAmount: o.totalAmount,
    itemsSummary: itemsSummary(o),
    courier: o.courier,
    trackingNo: o.trackingNo,
    // 선물 주문은 받는 분별 배송현황(성함·운송장만, 주소·전화 제외)
    shipments:
      o.kind === 'GIFT'
        ? o.shipments.map((s) => ({
            recipientName: s.recipientName,
            courier: s.courier,
            trackingNo: s.trackingNo,
          }))
        : [],
  }));

  return NextResponse.json({ orders: list });
}
