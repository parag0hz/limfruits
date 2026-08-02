'use client';

import { useState } from 'react';

/** 텍스트 복사 버튼 (운송장 번호 등) */
export default function CopyButton({
  text,
  label = '복사',
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 미지원 환경 — 조용히 무시 (텍스트가 화면에 그대로 있음)
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${text} ${label}`}
      className="inline-flex min-h-9 cursor-pointer items-center rounded-full border border-hairline bg-white px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface"
    >
      {copied ? '복사됨' : label}
    </button>
  );
}
