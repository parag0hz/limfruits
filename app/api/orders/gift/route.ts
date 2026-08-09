import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';
import { normalizePhone } from '@/lib/format';
import type { OrderItem } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_SHIPMENTS = 100;
const MAX_QUANTITY = 99;
const MAX_NAME = 30;
const MAX_GIFT_MESSAGE = 200;
const MAX_MEMO = 200;

interface ShipmentBody {
  recipientName?: unknown;
  phone?: unknown;
  postcode?: unknown;
  address1?: unknown;
  address2?: unknown;
  giftMessage?: unknown;
  optionId?: unknown;
  quantity?: unknown;
}

interface GiftBody {
  senderName?: unknown;
  senderPhone?: unknown;
  memo?: unknown;
  shipments?: unknown;
}

function asTrimmedString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function validPhone(p: string): boolean {
  return p.length >= 10 && p.length <= 11 && p.startsWith('0');
}

/**
 * 선물·대량 주문 생성 (다중 배송지) — v2.4.
 * 검증 → 각 배송 건의 옵션을 DB에서 조회해 품절·비활성 거부 →
 * 금액을 서버가 옵션가로 계산(클라이언트 금액 신뢰 금지) → createGiftOrder.
 * 응답: { orderNo, amount, orderName } (기존 단일 주문 결제 흐름 그대로 재사용).
 */
export async function POST(req: Request) {
  let body: GiftBody;
  try {
    body = (await req.json()) as GiftBody;
  } catch {
    return badRequest('요청 형식이 올바르지 않아요. 새로고침 후 다시 시도해 주세요.');
  }

  const senderName = asTrimmedString(body.senderName);
  const senderPhone = normalizePhone(asTrimmedString(body.senderPhone));
  const memo = asTrimmedString(body.memo);

  if (!senderName) {
    return badRequest('보내는 분 성함을 입력해 주세요.');
  }
  if (senderName.length > MAX_NAME) {
    return badRequest('보내는 분 성함은 30자 이내로 입력해 주세요.');
  }
  if (!validPhone(senderPhone)) {
    return badRequest('보내는 분 연락처를 정확히 입력해 주세요. 예: 010-1234-5678');
  }
  if (memo.length > MAX_MEMO) {
    return badRequest('주문 메모는 200자 이내로 입력해 주세요.');
  }

  if (!Array.isArray(body.shipments)) {
    return badRequest('받는 분 정보를 확인해 주세요.');
  }
  const rawShipments = body.shipments as ShipmentBody[];
  if (rawShipments.length < 1) {
    return badRequest('받는 분을 한 명 이상 추가해 주세요.');
  }
  if (rawShipments.length > MAX_SHIPMENTS) {
    return badRequest(
      `받는 분은 최대 ${MAX_SHIPMENTS}명까지 한 번에 주문하실 수 있어요.`
    );
  }

  const store = getStore();
  const prepared: Array<{
    recipientName: string;
    phone: string;
    postcode: string;
    address1: string;
    address2: string;
    giftMessage: string;
    items: OrderItem[];
  }> = [];
  let total = 0;

  for (let i = 0; i < rawShipments.length; i++) {
    const s = rawShipments[i];
    const label = `${i + 1}번째 받는 분`;

    const recipientName = asTrimmedString(s.recipientName);
    const phone = normalizePhone(asTrimmedString(s.phone));
    const postcode = asTrimmedString(s.postcode);
    const address1 = asTrimmedString(s.address1);
    const address2 = asTrimmedString(s.address2);
    const giftMessage = asTrimmedString(s.giftMessage);
    const optionId = asTrimmedString(s.optionId);
    const quantity = typeof s.quantity === 'number' ? s.quantity : NaN;

    if (!recipientName) {
      return badRequest(`${label}의 성함을 입력해 주세요.`);
    }
    if (recipientName.length > MAX_NAME) {
      return badRequest(`${label}의 성함은 30자 이내로 입력해 주세요.`);
    }
    if (!validPhone(phone)) {
      return badRequest(
        `${label}의 연락처를 정확히 입력해 주세요. 예: 010-1234-5678`
      );
    }
    if (!postcode || !address1) {
      return badRequest(`${label}의 배송지 주소를 입력해 주세요.`);
    }
    if (giftMessage.length > MAX_GIFT_MESSAGE) {
      return badRequest(`${label}의 선물 메시지는 200자 이내로 입력해 주세요.`);
    }
    if (!optionId) {
      return badRequest(`${label}의 상품 구성을 선택해 주세요.`);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return badRequest(
        `${label}의 수량은 1개부터 ${MAX_QUANTITY}개까지 담으실 수 있어요.`
      );
    }

    const option = await store.getOption(optionId);
    if (!option) {
      return badRequest(
        `${label}이 선택한 상품 구성을 찾을 수 없어요. 새로고침 후 다시 선택해 주세요.`
      );
    }
    if (option.soldOut) {
      return badRequest(
        `${label}이 선택한 구성은 현재 품절이에요. 다른 구성을 선택해 주세요.`,
        409
      );
    }
    const product = await store.getProduct(option.productId);
    if (!product || !product.isActive) {
      return badRequest(
        `${label}이 선택한 상품은 지금 판매하지 않아요. 다른 상품을 선택해 주세요.`,
        409
      );
    }

    const item: OrderItem = {
      productId: product.id,
      productName: product.name,
      optionId: option.id,
      optionName: option.name,
      unitPrice: option.price,
      quantity,
    };
    total += option.price * quantity;
    prepared.push({
      recipientName,
      phone,
      postcode,
      address1,
      address2,
      giftMessage,
      items: [item],
    });
  }

  // orderName: "대표상품 외 N건" (첫 배송 건의 상품·옵션을 대표로)
  const rep = prepared[0].items[0];
  const repName = `${rep.productName} ${rep.optionName}`;
  const orderName =
    prepared.length > 1 ? `${repName} 외 ${prepared.length - 1}건` : repName;

  const order = await store.createGiftOrder({
    senderName,
    senderPhone,
    memo,
    shipments: prepared,
    totalAmount: total,
  });

  return NextResponse.json({
    orderNo: order.orderNo,
    amount: order.totalAmount,
    orderName,
  });
}
