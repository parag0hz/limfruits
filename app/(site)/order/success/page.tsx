import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db';
import { createOrderViewToken } from '@/lib/order-token';
import { confirmPayment, getPayment, TossApiError } from '@/lib/toss';

export const dynamic = 'force-dynamic';

/**
 * 실패 안내는 코드만 넘기고 문구는 /order/fail의 화이트리스트에서 고른다.
 * (자유 텍스트를 URL로 넘겨 그대로 렌더링하면 텍스트 인젝션에 악용될 수 있음)
 */
function failUrl(code: string): string {
  return `/order/fail?${new URLSearchParams({ code }).toString()}`;
}

function completeUrl(orderNo: string): string {
  const token = createOrderViewToken(orderNo);
  return `/order/complete/${encodeURIComponent(orderNo)}?t=${encodeURIComponent(token)}`;
}

/** PENDING 주문 승인 유효시간: 생성 후 30분 (오래 방치된 주문 재사용 방지) */
const PENDING_CONFIRM_TTL_MS = 30 * 60 * 1000;

/**
 * 토스 successUrl 수신 → 서버에서 결제 승인(confirm) → 완료 페이지로 redirect.
 * - 금액은 DB의 totalAmount와 대조하고, 승인 요청에도 DB 금액을 사용한다.
 * - 이미 PAID인 주문은 승인 없이 완료 페이지로 (새로고침 멱등성).
 * - 승인 직전에 옵션 품절 여부와 주문 생성 시각(30분)을 재확인한다.
 */
export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paymentKey = typeof sp.paymentKey === 'string' ? sp.paymentKey : '';
  const orderId = typeof sp.orderId === 'string' ? sp.orderId : '';
  const amountParam = typeof sp.amount === 'string' ? sp.amount : '';

  if (!paymentKey || !orderId || !amountParam) {
    redirect(failUrl('LIMFRUITS_MISSING_PARAMS'));
  }

  const store = getStore();
  const order = await store.getOrderByNo(orderId);

  if (!order) {
    redirect(failUrl('LIMFRUITS_ORDER_NOT_FOUND'));
  }

  // 새로고침 등으로 다시 들어와도 멱등 처리
  if (
    order.status === 'PAID' ||
    order.status === 'SHIPPING' ||
    order.status === 'DONE'
  ) {
    redirect(completeUrl(order.orderNo));
  }

  if (order.status === 'CANCELED') {
    redirect(failUrl('LIMFRUITS_ORDER_CANCELED'));
  }

  // 금액 검증: 리다이렉트로 넘어온 금액이 DB 금액과 다르면 승인하지 않는다
  if (order.totalAmount !== Number(amountParam)) {
    redirect(failUrl('LIMFRUITS_AMOUNT_MISMATCH'));
  }

  // 오래 방치된 PENDING 주문은 승인하지 않는다 (품절/가격 변경 후 재사용 방지)
  const createdMs = new Date(order.createdAt).getTime();
  if (!Number.isFinite(createdMs) || Date.now() - createdMs > PENDING_CONFIRM_TTL_MS) {
    redirect(failUrl('LIMFRUITS_ORDER_EXPIRED'));
  }

  // 승인 직전 품절 재확인 (주문 생성 후 관리자가 품절 처리했을 수 있음)
  const optionId = order.items[0]?.optionId;
  const option = optionId ? await store.getOption(optionId) : null;
  if (!option || option.soldOut) {
    redirect(failUrl('LIMFRUITS_SOLD_OUT'));
  }

  // 결제 승인 (승인 금액은 반드시 DB의 totalAmount)
  let confirmFailCode: string | null = null;
  let method = '';
  try {
    const payment = await confirmPayment(paymentKey, order.orderNo, order.totalAmount);
    method = payment.method ?? '';
  } catch (err) {
    if (err instanceof TossApiError && err.code === 'ALREADY_PROCESSED_PAYMENT') {
      // "이미 승인된 결제"는 그대로 믿지 않는다 — paymentKey는 URL에서 온 값이므로
      // 반드시 토스에서 결제를 조회해 이 주문의 결제(orderId·금액·상태 DONE)인지 확인한다.
      try {
        const payment = await getPayment(paymentKey);
        if (
          payment.orderId === order.orderNo &&
          payment.totalAmount === order.totalAmount &&
          payment.status === 'DONE'
        ) {
          method = payment.method ?? '';
        } else {
          console.warn(
            '[limfruits] 이미 승인된 결제가 주문과 일치하지 않아 거부:',
            { orderNo: order.orderNo, paymentOrderId: payment.orderId, paymentStatus: payment.status }
          );
          confirmFailCode = 'LIMFRUITS_PAYMENT_MISMATCH';
        }
      } catch (lookupErr) {
        console.error('[limfruits] 결제 조회 실패:', lookupErr);
        confirmFailCode = 'LIMFRUITS_CONFIRM_ERROR';
      }
    } else if (err instanceof TossApiError) {
      console.warn('[limfruits] 결제 승인 실패:', err.code, err.message);
      confirmFailCode = err.code;
    } else {
      console.error('[limfruits] 결제 승인 중 오류:', err);
      confirmFailCode = 'LIMFRUITS_CONFIRM_ERROR';
    }
  }

  if (confirmFailCode) {
    redirect(failUrl(confirmFailCode));
  }

  // 승인 성공 → 주문을 PAID로
  let markFailed = false;
  try {
    await store.markPaid(order.orderNo, { paymentKey, method });
  } catch {
    markFailed = true;
  }

  if (markFailed) {
    redirect(failUrl('LIMFRUITS_MARK_PAID_FAILED'));
  }

  redirect(completeUrl(order.orderNo));
}
