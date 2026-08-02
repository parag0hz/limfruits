'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { ProductOption } from '@/lib/types';
import { formatWon } from '@/lib/format';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import QuantityStepper from '@/components/order/QuantityStepper';

const MAX_QUANTITY = 20;

interface BuyState {
  options: ProductOption[];
  selectedId: string;
  selectOption: (id: string) => void;
  quantity: number;
  setQuantity: (n: number) => void;
  optionError: string | null;
  selected: ProductOption | null;
  total: number;
  allSoldOut: boolean;
  goToOrder: () => void;
}

const BuyContext = createContext<BuyState | null>(null);

function useBuyState(): BuyState {
  const state = useContext(BuyContext);
  if (!state) {
    throw new Error('BuyPanelProvider 안에서만 사용할 수 있습니다.');
  }
  return state;
}

/**
 * 상품 상세 구매 상태 공급자 (client).
 * 옵션 선택 패널(BuyPanel)과 모바일 하단 구매 바(BuyBar)가 페이지 트리의
 * 서로 다른 위치에 놓여도 같은 선택 상태를 공유하도록 컨텍스트로 묶는다.
 * (하단 바를 페이지 흐름 마지막 요소의 sticky로 두기 위한 구조 —
 *  fixed로 두면 문서 끝의 푸터가 바에 영구적으로 가려진다)
 */
export function BuyPanelProvider({
  options,
  children,
}: {
  options: ProductOption[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [optionError, setOptionError] = useState<string | null>(null);

  const available = useMemo(() => options.filter((o) => !o.soldOut), [options]);
  const allSoldOut = options.length > 0 && available.length === 0;

  const selected =
    options.find((o) => o.id === selectedId && !o.soldOut) ?? null;
  const total = selected ? selected.price * quantity : 0;

  const selectOption = (id: string) => {
    setSelectedId(id);
    setOptionError(null);
  };

  const goToOrder = () => {
    if (!selected) {
      setOptionError('구성을 먼저 선택해 주세요.');
      const el = document.getElementById('buy-option-select');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLSelectElement) {
        el.focus({ preventScroll: true });
      }
      return;
    }
    router.push(
      `/order?option=${encodeURIComponent(selected.id)}&qty=${quantity}`
    );
  };

  return (
    <BuyContext.Provider
      value={{
        options,
        selectedId,
        selectOption,
        quantity,
        setQuantity,
        optionError,
        selected,
        total,
        allSoldOut,
        goToOrder,
      }}
    >
      {children}
    </BuyContext.Provider>
  );
}

export interface BuyPanelProps {
  productName: string;
  subtitle: string;
}

/**
 * 상품 상세 구매 패널 (client) — 옵션 select + 수량 + 합계 + 구매하기.
 * 데스크톱은 우측 스티키 패널로 쓰고, 모바일 구매 버튼은 BuyBar가 담당한다.
 * 반드시 BuyPanelProvider 안에서 렌더한다. 구매하기 → /order?option=<id>&qty=<n>
 */
export default function BuyPanel({ productName, subtitle }: BuyPanelProps) {
  const {
    options,
    selectedId,
    selectOption,
    quantity,
    setQuantity,
    optionError,
    selected,
    total,
    allSoldOut,
    goToOrder,
  } = useBuyState();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {productName}
        </h1>
        {subtitle && <p className="mt-1.5 text-base text-muted">{subtitle}</p>}
      </div>

      {options.length === 0 ? (
        <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">
          판매 구성을 준비하고 있습니다.
        </p>
      ) : (
        <>
          <Select
            id="buy-option-select"
            label="구성 선택"
            value={selectedId}
            error={optionError ?? undefined}
            onChange={(e) => selectOption(e.target.value)}
          >
            <option value="" disabled>
              구성을 선택해 주세요
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id} disabled={o.soldOut}>
                {o.name} · {formatWon(o.price)}
                {o.soldOut ? ' (품절)' : ''}
              </option>
            ))}
          </Select>

          {allSoldOut && (
            <p className="rounded-xl bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
              현재 모든 구성이 품절입니다. 다음 수확 시 다시 판매합니다.
            </p>
          )}

          {selected && (
            <div className="rounded-xl bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{selected.name}</p>
                  {selected.description && (
                    <p className="mt-0.5 text-sm text-muted">
                      {selected.description}
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-ink">
                  {formatWon(selected.price)}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
                <span className="text-sm font-medium text-ink">수량</span>
                <QuantityStepper
                  value={quantity}
                  min={1}
                  max={MAX_QUANTITY}
                  onChange={setQuantity}
                />
              </div>
            </div>
          )}

          <div className="flex items-baseline justify-between border-t border-hairline pt-4">
            <span className="text-sm font-medium text-muted">합계</span>
            <p className="text-2xl font-bold tabular-nums text-ink sm:text-3xl">
              {formatWon(total)}
              <span className="ml-1 text-sm font-normal text-muted">
                배송비 포함
              </span>
            </p>
          </div>

          {/* 데스크톱/태블릿 구매 버튼 — 모바일은 하단 구매 바(BuyBar) 사용 */}
          <Button
            size="lg"
            onClick={goToOrder}
            disabled={allSoldOut}
            className="hidden w-full lg:inline-flex"
          >
            {allSoldOut ? '품절' : '구매하기'}
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * 모바일 하단 구매 바 (client) — 상세 페이지의 풀폭 래퍼 마지막 요소로 배치한다.
 * fixed가 아니라 sticky라 문서 끝까지 내리면 푸터가 온전히 드러난다.
 * (OrderForm의 하단 결제 바와 같은 방식. 부모가 풀폭이므로 네거티브 마진 불필요)
 */
export function BuyBar() {
  const { options, selected, quantity, total, allSoldOut, goToOrder } =
    useBuyState();

  if (options.length === 0) return null;

  return (
    <div className="sticky bottom-0 z-40 mt-10 border-t border-hairline bg-white/95 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">
            {selected
              ? `${selected.name} · ${quantity}개`
              : '구성을 선택해 주세요'}
          </p>
          <p className="text-lg font-bold tabular-nums text-ink">
            {formatWon(total)}
          </p>
        </div>
        <Button
          size="lg"
          onClick={goToOrder}
          disabled={allSoldOut}
          className="shrink-0"
        >
          {allSoldOut ? '품절' : '구매하기'}
        </Button>
      </div>
    </div>
  );
}
