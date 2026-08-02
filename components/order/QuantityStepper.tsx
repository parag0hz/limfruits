'use client';

export interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

/** 수량 스테퍼: - / + 버튼 (터치 타깃 44px+) */
export default function QuantityStepper({
  value,
  min = 1,
  max = 20,
  onChange,
  disabled = false,
}: QuantityStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="inline-flex items-center rounded-xl border border-hairline bg-white">
      <button
        type="button"
        aria-label="수량 줄이기"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-l-xl text-xl font-medium text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span
        aria-live="polite"
        className="min-w-12 border-x border-hairline text-center text-base font-semibold tabular-nums text-ink"
      >
        {value}
        <span className="sr-only">개</span>
      </span>
      <button
        type="button"
        aria-label="수량 늘리기"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-r-xl text-xl font-medium text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
