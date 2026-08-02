'use client';

import type { ProductOption } from '@/lib/types';
import { formatWon } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import Badge from '@/components/ui/Badge';

export interface OptionPickerProps {
  options: ProductOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** 상품 옵션 라디오 카드 목록 — 같은 상품의 옵션만 넘긴다 (품절 옵션은 선택 불가) */
export default function OptionPicker({
  options,
  selectedId,
  onSelect,
}: OptionPickerProps) {
  return (
    <div role="radiogroup" aria-label="상품 옵션 선택" className="flex flex-col gap-2.5">
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.soldOut}
            onClick={() => onSelect(option.id)}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors',
              selected
                ? 'border-brand bg-brand/5'
                : 'border-hairline bg-white hover:border-muted/40',
              option.soldOut &&
                'cursor-not-allowed border-hairline bg-surface opacity-60 hover:border-hairline'
            )}
          >
            <span className="flex items-center gap-3">
              {/* 라디오 표시 동그라미 */}
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-white',
                  selected ? 'border-brand' : 'border-muted/40'
                )}
              >
                {selected && (
                  <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                )}
              </span>
              <span className="flex flex-col">
                <span className="font-medium text-ink">{option.name}</span>
                {option.description && (
                  <span className="text-sm text-muted">
                    {option.description}
                  </span>
                )}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              {option.soldOut ? (
                <Badge tone="red">품절</Badge>
              ) : (
                <span className="font-semibold tabular-nums text-ink">
                  {formatWon(option.price)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
