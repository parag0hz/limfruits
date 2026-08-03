"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";

interface ImportResult {
  updated: number;
  skipped: { orderNo: string; reason: string }[];
}

/**
 * 신규주문 탭의 송장 도구 — 로젠 iSales 왕복 워크플로.
 * 1) 신규주문 엑셀 받기 → iSales에 올려 송장 일괄 출력
 * 2) 송장번호가 담긴 엑셀을 올리면 주문들이 자동으로 배송중 처리
 */
export default function ShippingTools({ paidCount }: { paidCount: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  async function onFileChosen(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("courier", "로젠택배");
      const res = await fetch("/api/admin/orders/import-tracking", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        setMessage({
          tone: "error",
          text: data.error ?? "운송장 등록에 실패했습니다. 다시 시도해 주세요.",
        });
        return;
      }
      const skippedText =
        data.skipped.length > 0
          ? ` (건너뜀 ${data.skipped.length}건: ${data.skipped
              .slice(0, 3)
              .map((s) => `${s.orderNo} — ${s.reason}`)
              .join(", ")}${data.skipped.length > 3 ? " 외" : ""})`
          : "";
      setMessage({
        tone: data.updated > 0 ? "ok" : "error",
        text: `운송장 ${data.updated}건을 등록하고 배송중으로 바꿨습니다.${skippedText}`,
      });
      router.refresh();
    } catch {
      setMessage({
        tone: "error",
        text: "업로드 중 문제가 생겼습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-hairline bg-surface p-4">
      <p className="text-base font-bold text-ink">송장 출력 (로젠택배)</p>
      <p className="mt-1 text-sm leading-6 text-muted">
        1. 신규주문 엑셀을 받아 로젠 iSales에 올려 송장을 출력하세요. 2. 송장번호가
        담긴 엑셀을 여기에 올리면 주문이 자동으로 배송중이 됩니다.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href="/api/admin/orders/export?status=PAID"
          className={cn(
            "inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-5 text-base font-semibold text-white transition-colors hover:bg-brand-dark",
            paidCount === 0 && "pointer-events-none opacity-40"
          )}
          aria-disabled={paidCount === 0}
        >
          1. 신규주문 엑셀 받기{paidCount > 0 ? ` (${paidCount}건)` : ""}
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-hairline bg-white px-5 text-base font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50"
        >
          {busy ? "등록 중..." : "2. 운송장 엑셀 올리기"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFileChosen(f);
          }}
        />
      </div>
      {message && (
        <p
          role="status"
          className={cn(
            "mt-3 rounded-xl px-4 py-3 text-base font-medium",
            message.tone === "ok"
              ? "bg-brand/10 text-brand-dark"
              : "bg-danger/10 text-danger"
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
