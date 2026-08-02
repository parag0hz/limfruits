import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import type { OrderStatus } from "@/lib/types";
import { cancelPayment, TossApiError } from "@/lib/toss";

const VALID_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPING",
  "DONE",
  "CANCELED",
];

function isOrderStatus(v: unknown): v is OrderStatus {
  return (
    typeof v === "string" && (VALID_STATUSES as readonly string[]).includes(v)
  );
}

/**
 * PATCH /api/admin/orders/[orderNo]
 * body: { status?, courier?, trackingNo?, cancelReason? }
 * - status는 OrderStatus enum만 허용
 * - CANCELED로 변경 시 paymentKey가 있으면 토스 결제취소 API 호출
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { orderNo } = await params;

  let body: {
    status?: unknown;
    courier?: unknown;
    trackingNo?: unknown;
    cancelReason?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  // --- 입력 검증 ---
  const patch: {
    status?: OrderStatus;
    courier?: string;
    trackingNo?: string;
  } = {};

  if (body.status !== undefined) {
    if (!isOrderStatus(body.status)) {
      return NextResponse.json(
        { error: "허용되지 않는 주문 상태입니다." },
        { status: 400 }
      );
    }
    patch.status = body.status;
  }

  if (body.courier !== undefined) {
    if (typeof body.courier !== "string" || body.courier.trim() === "") {
      return NextResponse.json(
        { error: "택배사를 선택해 주세요." },
        { status: 400 }
      );
    }
    patch.courier = body.courier.trim();
  }

  if (body.trackingNo !== undefined) {
    if (typeof body.trackingNo !== "string" || body.trackingNo.trim() === "") {
      return NextResponse.json(
        { error: "운송장 번호를 입력해 주세요." },
        { status: 400 }
      );
    }
    patch.trackingNo = body.trackingNo.trim();
  }

  if (
    patch.status === undefined &&
    patch.courier === undefined &&
    patch.trackingNo === undefined
  ) {
    return NextResponse.json(
      { error: "변경할 내용이 없습니다." },
      { status: 400 }
    );
  }

  const store = getStore();
  const order = await store.getOrderByNo(orderNo);
  if (!order) {
    return NextResponse.json(
      { error: "주문을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 발송 처리 시 택배사 + 운송장 필수 (기존 값이 있으면 유지 가능)
  if (patch.status === "SHIPPING") {
    const courier = patch.courier ?? order.courier;
    const trackingNo = patch.trackingNo ?? order.trackingNo;
    if (!courier || !trackingNo) {
      return NextResponse.json(
        { error: "발송 처리하려면 택배사와 운송장 번호를 입력해 주세요." },
        { status: 400 }
      );
    }
  }

  // --- 결제취소 처리 ---
  if (patch.status === "CANCELED") {
    if (order.status === "CANCELED") {
      return NextResponse.json({ ok: true, order }); // 이미 취소됨 (멱등)
    }
    const cancelReason =
      typeof body.cancelReason === "string" && body.cancelReason.trim() !== ""
        ? body.cancelReason.trim()
        : "관리자 취소";
    if (order.paymentKey) {
      try {
        await cancelPayment(order.paymentKey, cancelReason);
      } catch (e) {
        // 토스 쪽에서 이미 취소된 결제라면 성공으로 간주하고 주문 상태만 맞춘다
        const alreadyCanceled =
          e instanceof TossApiError && e.code === "ALREADY_CANCELED_PAYMENT";
        if (!alreadyCanceled) {
          console.error("[limfruits] 토스 결제취소 실패:", e);
          return NextResponse.json(
            {
              error:
                "결제취소에 실패했습니다. 잠시 후 다시 시도하거나 토스페이먼츠 관리자에서 확인해 주세요.",
            },
            { status: 502 }
          );
        }
      }
    }
  }

  await store.updateOrder(orderNo, patch);
  const updated = await store.getOrderByNo(orderNo);
  return NextResponse.json({ ok: true, order: updated });
}
