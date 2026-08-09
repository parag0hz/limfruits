'use client';

import { memo } from 'react';
import { formatWon } from '@/lib/format';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import QuantityStepper from '@/components/order/QuantityStepper';
import AddressFields from '@/components/order/AddressFields';
import type {
  OptionChoice,
  ProductLite,
  RecipientDraft,
  RecipientErrors,
} from './types';

const MAX_QUANTITY = 99;
const MAX_GIFT_MESSAGE = 200;

export interface RecipientCardProps {
  index: number;
  draft: RecipientDraft;
  products: ProductLite[];
  options: OptionChoice[];
  errors?: RecipientErrors;
  removable: boolean;
  onChange: (key: string, patch: Partial<RecipientDraft>) => void;
  onRemove: (key: string) => void;
  onClearError: (key: string, field: keyof RecipientErrors) => void;
}

/**
 * 받는 분 1건 카드 (프레젠테이션) — 구성·수량·성함·연락처·주소·선물 메시지.
 * 상태는 상위 GiftOrderForm이 관리하고 onChange 로 패치한다.
 *
 * 콜백은 받는 분 key 를 첫 인자로 받는 안정 함수(상위에서 useCallback)로 전달되고,
 * 이 컴포넌트는 React.memo 로 감싸므로 대량(수십~100건) 입력 시에도 값이 바뀐
 * 카드만 리렌더된다.
 */
function RecipientCard({
  index,
  draft,
  products,
  options,
  errors,
  removable,
  onChange,
  onRemove,
  onClearError,
}: RecipientCardProps) {
  const selected = options.find((o) => o.id === draft.optionId) ?? null;
  const subtotal = selected ? selected.price * draft.quantity : 0;

  return (
    <Card id={`gift-recipient-${draft.key}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold tracking-tight text-ink">
          받는 분 {index + 1}
        </h3>
        {removable && (
          <button
            type="button"
            onClick={() => onRemove(draft.key)}
            className="cursor-pointer text-sm font-medium text-muted transition-colors hover:text-danger"
          >
            삭제
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Select
          label="상품 구성"
          required
          value={draft.optionId}
          error={errors?.option}
          onChange={(e) => {
            onChange(draft.key, { optionId: e.target.value });
            onClearError(draft.key, 'option');
          }}
        >
          <option value="" disabled>
            구성을 선택해 주세요
          </option>
          {products.map((p) => {
            const forProduct = options.filter((o) => o.productId === p.id);
            if (forProduct.length === 0) return null;
            return (
              <optgroup key={p.id} label={p.name}>
                {forProduct.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · {formatWon(o.price)}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </Select>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">수량</span>
          <QuantityStepper
            value={draft.quantity}
            min={1}
            max={MAX_QUANTITY}
            onChange={(n) => onChange(draft.key, { quantity: n })}
          />
        </div>

        {selected && (
          <div className="flex items-baseline justify-between border-t border-hairline pt-3">
            <span className="text-sm text-muted">소계</span>
            <span className="font-semibold tabular-nums text-ink">
              {formatWon(subtotal)}
            </span>
          </div>
        )}

        <div className="border-t border-hairline pt-3">
          <Input
            label="받는 분 성함"
            required
            value={draft.recipientName}
            onChange={(e) => {
              onChange(draft.key, { recipientName: e.target.value });
              onClearError(draft.key, 'name');
            }}
            placeholder="홍길동"
            autoComplete="off"
            error={errors?.name}
          />
        </div>

        <Input
          label="받는 분 연락처"
          required
          type="tel"
          inputMode="numeric"
          value={draft.phone}
          onChange={(e) => {
            onChange(draft.key, { phone: e.target.value });
            onClearError(draft.key, 'phone');
          }}
          placeholder="010-1234-5678"
          autoComplete="off"
          error={errors?.phone}
        />

        <AddressFields
          postcode={draft.postcode}
          address1={draft.address1}
          address2={draft.address2}
          onAddressSelect={(postcode, address1) => {
            onChange(draft.key, { postcode, address1 });
            onClearError(draft.key, 'address');
          }}
          onAddress2Change={(address2) => onChange(draft.key, { address2 })}
          error={errors?.address}
        />

        <Textarea
          label="선물 메시지"
          value={draft.giftMessage}
          onChange={(e) => {
            onChange(draft.key, { giftMessage: e.target.value });
            onClearError(draft.key, 'message');
          }}
          placeholder="받는 분께 전할 짧은 메시지 (선택)"
          rows={2}
          maxLength={MAX_GIFT_MESSAGE}
          hint="200자 이내"
          error={errors?.message}
        />
      </div>
    </Card>
  );
}

export default memo(RecipientCard);
