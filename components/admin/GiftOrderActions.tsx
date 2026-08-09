"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface Props {
  orderNo: string;
  status: OrderStatus;
  /** 모든 배송 건에 운송장이 입력됐는지 (서버 계산) */
  allTracked: boolean;
  hasPaymentKey: boolean;
}

/**
 * 선물(GIFT) 주문의 주문 단위 상태 전이.
 * - 전체 발송 처리: 모든 배송 건에 운송장이 있으면 주문을 배송중으로
 * - 배송완료 처리 / 결제취소는 단일 주문과 동일
 */
export default function GiftOrderActions({
  orderNo,
  status,
  allTracked,
  hasPaymentKey,
}: Props) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function patchOrder(body: Record<string, unknown>, successText: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderNo}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data?.error ?? "처리에 실패했습니다. 다시 시도해 주세요.",
        });
        return;
      }
      setMessage({ type: "success", text: successText });
      router.refresh();
    } catch {
      setMessage({
        type: "error",
        text: "연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleShipAll() {
    if (!allTracked) {
      setMessage({
        type: "error",
        text: "먼저 모든 배송 건에 운송장을 입력해 주세요.",
      });
      return;
    }
    void patchOrder(
      { status: "SHIPPING" },
      "전체 발송 처리했습니다. 주문이 '배송중'으로 바뀌었습니다."
    );
  }

  function handleDone() {
    void patchOrder({ status: "DONE" }, "배송완료 처리했습니다.");
  }

  function handleCancel() {
    const confirmed = window.confirm(
      hasPaymentKey
        ? "정말 이 주문을 취소할까요?\n결제된 금액이 손님께 환불됩니다."
        : "정말 이 주문을 취소할까요?"
    );
    if (!confirmed) return;
    void patchOrder(
      {
        status: "CANCELED",
        cancelReason: cancelReason.trim() || "관리자 취소",
      },
      "주문을 취소했습니다."
    );
  }

  const canShip = status === "PAID";
  const canComplete = status === "SHIPPING";
  const canCancel =
    status === "PENDING" || status === "PAID" || status === "SHIPPING";

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <p
          role="status"
          className={
            message.type === "success"
              ? "rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-lg font-bold text-brand-dark"
              : "rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-lg font-bold text-danger"
          }
        >
          {message.text}
        </p>
      )}

      {/* 전체 발송 처리 */}
      {canShip && (
        <Card padding="sm">
          <h2 className="text-lg font-bold text-ink">전체 발송 처리</h2>
          <p className="mt-1 text-base text-muted">
            모든 배송 건에 운송장을 입력하면 주문 전체를 배송중으로 바꿀 수
            있습니다.
          </p>
          <Button
            size="lg"
            disabled={busy || !allTracked}
            onClick={handleShipAll}
            className="mt-3 w-full text-xl"
          >
            {busy ? "처리 중..." : "전체 발송 처리"}
          </Button>
          {!allTracked && (
            <p className="mt-2 text-base font-semibold text-danger">
              아직 운송장이 입력되지 않은 배송 건이 있습니다.
            </p>
          )}
        </Card>
      )}

      {/* 배송완료 처리 */}
      {canComplete && (
        <Card padding="sm">
          <h2 className="text-lg font-bold text-ink">배송완료 처리</h2>
          <p className="mt-1 text-base text-muted">
            손님이 상품을 받으셨으면 눌러 주세요.
          </p>
          <Button
            size="lg"
            variant="outline"
            disabled={busy}
            onClick={handleDone}
            className="mt-3 w-full text-xl"
          >
            {busy ? "처리 중..." : "배송완료 처리"}
          </Button>
        </Card>
      )}

      {/* 결제취소 */}
      {canCancel && (
        <Card padding="sm" className="border-danger/40">
          <h2 className="text-lg font-bold text-danger">주문 취소</h2>
          {!cancelOpen ? (
            <Button
              size="lg"
              variant="danger"
              disabled={busy}
              onClick={() => setCancelOpen(true)}
              className="mt-3 w-full text-xl"
            >
              결제취소
            </Button>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <Input
                label="취소 사유"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="예: 손님 요청, 재고 부족"
                hint={
                  hasPaymentKey
                    ? "취소하면 결제된 금액이 손님께 환불됩니다."
                    : undefined
                }
              />
              <div className="flex gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setCancelOpen(false);
                    setCancelReason("");
                  }}
                  className="flex-1 text-lg"
                >
                  돌아가기
                </Button>
                <Button
                  size="lg"
                  variant="danger"
                  disabled={busy}
                  onClick={handleCancel}
                  className="flex-1 text-lg"
                >
                  {busy ? "처리 중..." : "취소 확정"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {status === "DONE" && (
        <p className="rounded-xl border border-hairline bg-surface px-4 py-3 text-center text-lg font-semibold text-muted">
          배송이 완료된 주문입니다.
        </p>
      )}
      {status === "CANCELED" && (
        <p className="rounded-xl border border-hairline bg-surface px-4 py-3 text-center text-lg font-semibold text-muted">
          취소된 주문입니다.
        </p>
      )}
    </div>
  );
}
