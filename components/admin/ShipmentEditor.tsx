"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  shipmentId: string;
  courier: string | null;
  trackingNo: string | null;
}

/**
 * 선물 주문의 배송 건(shipment) 하나에 대한 운송장 입력·저장.
 * PATCH /api/admin/orders/[orderNo] 에 shipmentId 를 담아 그 건만 저장한다.
 */
export default function ShipmentEditor({
  orderNo,
  shipmentId,
  courier,
  trackingNo,
}: Props) {
  const router = useRouter();
  const [courierValue, setCourierValue] = useState(courier ?? COURIERS[0]);
  const [trackingValue, setTrackingValue] = useState(trackingNo ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const saved = Boolean(courier && trackingNo);

  async function handleSave() {
    if (busy) return;
    if (trackingValue.trim() === "") {
      setMessage({ type: "error", text: "운송장 번호를 입력해 주세요." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderNo}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId,
          courier: courierValue,
          trackingNo: trackingValue.trim(),
        }),
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
          text: data?.error ?? "저장에 실패했습니다. 다시 시도해 주세요.",
        });
        return;
      }
      setMessage({ type: "success", text: "운송장을 저장했습니다." });
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

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-bold text-ink">운송장</p>
        {saved && (
          <span className="text-base font-semibold text-brand-dark">
            등록됨
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-2.5">
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
          onClick={handleSave}
          className="w-full text-lg"
        >
          {busy ? "저장 중..." : saved ? "운송장 수정" : "운송장 저장"}
        </Button>
      </div>
      {message && (
        <p
          role="status"
          className={
            message.type === "success"
              ? "mt-2.5 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-base font-bold text-brand-dark"
              : "mt-2.5 rounded-xl border border-danger/40 bg-danger/5 px-4 py-2.5 text-base font-bold text-danger"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
