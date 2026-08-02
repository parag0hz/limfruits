"use client";

import { cn } from "@/components/ui/cn";
import { formatWon } from "@/lib/format";

/** 숫자만 남긴 가격 문자열 → { price, valid }. 1원 이상의 정수만 유효 */
export function parsePriceText(text: string): { price: number; valid: boolean } {
  const price = Number(text || "0");
  return { price, valid: Number.isInteger(price) && price > 0 };
}

/**
 * 가격 입력 필드 (옵션 편집·추가 공용).
 * 숫자만 입력받고, 아래에 "27,000원" 형태로 다시 보여줘 실수를 줄인다.
 */
export default function PriceField({
  id,
  label = "가격 (배송비 포함)",
  value,
  onChange,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { price, valid } = parsePriceText(value);
  const invalid = value !== "" && !valid;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          placeholder="27000"
          aria-invalid={invalid ? true : undefined}
          className={cn(
            "w-full rounded-xl border bg-white px-4 py-3 pr-12 text-right text-xl font-bold text-ink tabular-nums placeholder:font-normal placeholder:text-muted focus:outline-none",
            invalid
              ? "border-danger focus:border-danger"
              : "border-ink/20 focus:border-brand"
          )}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 right-4 -translate-y-1/2 text-lg font-semibold text-muted"
        >
          원
        </span>
      </div>
      {valid && (
        <p className="text-base font-semibold text-brand-dark tabular-nums">
          {formatWon(price)}
        </p>
      )}
    </div>
  );
}
