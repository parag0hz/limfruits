"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** 새 주문 확인용 새로고침 버튼 (server component 데이터 재조회) */
export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    startTransition(() => {
      router.refresh();
    });
    // 반응이 너무 빨라도 눌린 느낌을 주도록 잠깐 유지
    setTimeout(() => setSpinning(false), 600);
  }

  const busy = isPending || spinning;

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={busy}
      className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-hairline bg-white px-5 text-lg font-semibold text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={busy ? "h-5 w-5 animate-spin" : "h-5 w-5"}
      >
        <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6" />
        <path d="M16.5 2.5v3h-3" />
      </svg>
      {busy ? "새로고침 중..." : "새로고침"}
    </button>
  );
}
