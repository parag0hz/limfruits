"use client";

import { useRef, useState } from "react";
import { cn } from "@/components/ui/cn";

/** 텍스트 복사 버튼 (운송장 출력 시 주소 붙여넣기용) */
export default function CopyButton({
  text,
  label = "복사",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleCopy() {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // 구형 브라우저 폴백
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 text-base font-semibold transition-colors",
        copied
          ? "bg-brand text-white"
          : "border border-hairline bg-white text-ink hover:bg-surface",
        className
      )}
    >
      {copied ? "복사 완료" : label}
    </button>
  );
}
