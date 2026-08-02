"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";

const COURIERS = [
  "CJ대한통운",
  "우체국택배",
  "한진택배",
  "롯데택배",
  "로젠택배",
  "기타",
];

interface Props {
  orderNo: string;
  status: OrderStatus;
  courier: string | null;
  trackingNo: string | null;
  hasPaymentKey: boolean;
}

export default function OrderActions({
  orderNo,
  status,
  courier,
  trackingNo,
  hasPaymentKey,
}: Props) {
  const router = useRouter();
  const [courierValue, setCourierValue] = useState(courier ?? COURIERS[0]);
  const [trackingValue, setTrackingValue] = useState(trackingNo ?? "");
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

  function handleShip() {
    if (trackingValue.trim() === "") {
      setMessage({ type: "error", text: "운송장 번호를 입력해 주세요." });
      return;
    }
    void patchOrder(
      {
        status: "SHIPPING",
        courier: courierValue,
        trackingNo: trackingValue.trim(),
      },
      "발송 처리했습니다. 주문이 '배송중'으로 바뀌었습니다."
    );
  }

  function handleDone() {
    void patchOrder(
      { status: "DONE" },
      "배송완료 처리했습니다."
    );
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

  const canShip = status === "PAID" || status === "SHIPPING";
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
              ? "rounded-2xl border-2 border-brand bg-brand-light px-4 py-3 text-lg font-bold text-brand-dark"
              : "rounded-2xl border-2 border-accent-red bg-accent-red/10 px-4 py-3 text-lg font-bold text-accent-red"
          }
        >
          {message.text}
        </p>
      )}

      {/* 운송장 입력 → 발송 처리 */}
      {canShip && (
        <Card padding="sm">
          <h2 className="text-lg font-bold text-brand-dark">
            {status === "SHIPPING" ? "운송장 수정" : "발송 처리"}
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <Select
              label="택배사"
              value={courierValue}
              onChange={(e) => setCourierValue(e.target.value)}
            >
              {COURIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input
              label="운송장 번호"
              value={trackingValue}
              onChange={(e) => setTrackingValue(e.target.value)}
              inputMode="numeric"
              placeholder="운송장 번호 입력"
            />
            <Button
              size="lg"
              disabled={busy}
              onClick={handleShip}
              className="w-full text-xl"
            >
              {busy
                ? "처리 중..."
                : status === "SHIPPING"
                  ? "운송장 저장"
                  : "발송 처리"}
            </Button>
            {status === "PAID" && (
              <p className="text-base text-ink/60">
                발송 처리하면 주문 상태가 &lsquo;배송중&rsquo;으로 바뀝니다.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* 배송완료 처리 */}
      {canComplete && (
        <Card padding="sm">
          <h2 className="text-lg font-bold text-brand-dark">배송완료 처리</h2>
          <p className="mt-1 text-base text-ink/60">
            손님이 배를 잘 받으셨으면 눌러 주세요.
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
        <Card padding="sm" className="border-accent-red/60">
          <h2 className="text-lg font-bold text-accent-red">주문 취소</h2>
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
        <p className="rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-center text-lg font-bold text-ink/50">
          배송이 완료된 주문입니다.
        </p>
      )}
      {status === "CANCELED" && (
        <p className="rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-center text-lg font-bold text-ink/50">
          취소된 주문입니다.
        </p>
      )}
    </div>
  );
}
