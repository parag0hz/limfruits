'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadTossPayments,
  ANONYMOUS,
  type TossPaymentsWidgets,
  type WidgetPaymentMethodWidget,
  type WidgetAgreementWidget,
} from '@tosspayments/tosspayments-sdk';
import type { ProductOption } from '@/lib/types';
import { formatWon, normalizePhone } from '@/lib/format';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import SectionTitle from '@/components/ui/SectionTitle';
import Textarea from '@/components/ui/Textarea';
import OptionPicker from './OptionPicker';
import QuantityStepper from './QuantityStepper';
import AddressFields from './AddressFields';

/**
 * 문서 공개 테스트 클라이언트 키 (결제위젯 연동용).
 * 출처: https://docs.tosspayments.com 결제위젯 v2 연동 가이드 및
 * 공식 샘플 저장소 github.com/tosspayments/tosspayments-sample (checkout.html).
 * 테스트 전용 공개 키 — 실 결제가 일어나지 않는다. 운영 전 반드시 교체.
 */
const DOCS_TEST_CLIENT_KEY = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

const CLIENT_KEY =
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || DOCS_TEST_CLIENT_KEY;

const MAX_QUANTITY = 20;

interface FieldErrors {
  option?: string;
  name?: string;
  phone?: string;
  address?: string;
}

export interface OrderFormProps {
  /** 주문 대상 상품명 — 제목·주문 요약에 표시 */
  productName: string;
  /** 같은 상품에 속한 옵션만 넘긴다 */
  options: ProductOption[];
  preselectedId?: string;
  initialQuantity?: number;
}

export default function OrderForm({
  productName,
  options,
  preselectedId,
  initialQuantity = 1,
}: OrderFormProps) {
  const available = useMemo(
    () => options.filter((o) => !o.soldOut),
    [options]
  );

  const initialId = useMemo(() => {
    const preselected = options.find(
      (o) => o.id === preselectedId && !o.soldOut
    );
    return preselected?.id ?? available[0]?.id ?? null;
  }, [options, preselectedId, available]);

  // 주문 입력 상태
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [quantity, setQuantity] = useState(() =>
    Math.min(Math.max(initialQuantity, 1), MAX_QUANTITY)
  );
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [memo, setMemo] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 토스 결제위젯 상태
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const paymentMethodWidgetRef = useRef<WidgetPaymentMethodWidget | null>(null);
  const agreementWidgetRef = useRef<WidgetAgreementWidget | null>(null);
  const widgetInitStartedRef = useRef(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [widgetRetryKey, setWidgetRetryKey] = useState(0);
  const [agreedRequiredTerms, setAgreedRequiredTerms] = useState(true);

  const selectedOption =
    options.find((o) => o.id === selectedId && !o.soldOut) ?? null;
  const total = selectedOption ? selectedOption.price * quantity : 0;
  const totalRef = useRef(total); // 이펙트/핸들러에서 최신 금액 참조용 (아래 이펙트에서 갱신)

  // 결제위젯 렌더: setAmount → renderPaymentMethods → renderAgreement
  // StrictMode의 이펙트 2회 실행으로 중복 렌더되지 않도록 ref로 1회만 초기화한다.
  useEffect(() => {
    if (available.length === 0) return; // 전부 품절이면 위젯 생략
    if (widgetInitStartedRef.current) return;
    widgetInitStartedRef.current = true;

    (async () => {
      try {
        // 재시도라면 이전 시도에서 부분 렌더된 위젯을 먼저 정리
        if (paymentMethodWidgetRef.current) {
          await paymentMethodWidgetRef.current.destroy().catch(() => {});
          paymentMethodWidgetRef.current = null;
        }
        if (agreementWidgetRef.current) {
          await agreementWidgetRef.current.destroy().catch(() => {});
          agreementWidgetRef.current = null;
        }

        const tossPayments = await loadTossPayments(CLIENT_KEY);
        const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({
          currency: 'KRW',
          value: totalRef.current,
        });
        paymentMethodWidgetRef.current = await widgets.renderPaymentMethods({
          selector: '#toss-payment-methods',
          variantKey: 'DEFAULT',
        });
        agreementWidgetRef.current = await widgets.renderAgreement({
          selector: '#toss-agreement',
        });
        agreementWidgetRef.current.on('agreementStatusChange', (status) => {
          setAgreedRequiredTerms(status.agreedRequiredTerms);
        });
        widgetsRef.current = widgets;
        setWidgetError(null);
        setWidgetReady(true);
      } catch {
        setWidgetError(
          '결제 화면을 불러오지 못했어요. 인터넷 연결을 확인한 뒤 아래 버튼으로 다시 시도해 주세요.'
        );
      }
    })();
  }, [available.length, widgetRetryKey]);

  // 옵션/수량이 바뀌면 위젯 금액 갱신
  useEffect(() => {
    totalRef.current = total;
    if (!widgetReady || total <= 0) return;
    widgetsRef.current
      ?.setAmount({ currency: 'KRW', value: total })
      .catch(() => {
        // 금액 갱신 실패는 결제 요청 단계에서 다시 걸러진다
      });
  }, [total, widgetReady]);

  const validate = useCallback((): FieldErrors => {
    const next: FieldErrors = {};
    if (!selectedOption) {
      next.option = '주문하실 옵션을 선택해 주세요.';
    }
    if (!customerName.trim()) {
      next.name = '성함을 입력해 주세요.';
    } else if (customerName.trim().length > 30) {
      next.name = '성함은 30자 이내로 입력해 주세요.';
    }
    const digits = normalizePhone(phone);
    if (!digits) {
      next.phone = '연락처를 입력해 주세요.';
    } else if (
      digits.length < 10 ||
      digits.length > 11 ||
      !digits.startsWith('0')
    ) {
      next.phone = '연락처를 정확히 입력해 주세요. 예: 010-1234-5678';
    }
    if (!postcode || !address1.trim()) {
      next.address = '주소검색 버튼으로 배송지 주소를 입력해 주세요.';
    }
    return next;
  }, [selectedOption, customerName, phone, postcode, address1]);

  const handlePay = useCallback(async () => {
    setSubmitError(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError('입력하지 않은 항목이 있어요. 위 내용을 확인해 주세요.');
      // 긴 폼에서 하단 고정 버튼만 보고 눌렀을 때 "무반응"처럼 보이지 않도록
      // 첫 번째 에러 위치로 스크롤하고, 입력칸이면 포커스까지 준다.
      const firstKey = (['option', 'name', 'phone', 'address'] as const).find(
        (k) => nextErrors[k]
      );
      const targetId =
        firstKey === 'option'
          ? 'order-section-option'
          : firstKey === 'name'
            ? 'order-input-name'
            : firstKey === 'phone'
              ? 'order-input-phone'
              : 'order-section-address';
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el instanceof HTMLInputElement) {
          el.focus({ preventScroll: true });
        }
      }
      return;
    }
    if (!widgetsRef.current || !widgetReady) {
      setSubmitError(
        '결제 화면이 아직 준비되지 않았어요. 잠시 후 다시 눌러 주세요.'
      );
      return;
    }
    if (!agreedRequiredTerms) {
      setSubmitError('결제 진행을 위해 필수 약관에 동의해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      // 1) 서버에 PENDING 주문 생성 (금액은 서버가 계산)
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId: selectedOption!.id,
          quantity,
          customerName: customerName.trim(),
          phone: normalizePhone(phone),
          postcode,
          address1: address1.trim(),
          address2: address2.trim(),
          memo: memo.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        orderNo?: string;
        amount?: number;
        orderName?: string;
        error?: string;
      };
      if (!res.ok || !data.orderNo || !data.orderName) {
        setSubmitError(
          data.error ?? '주문을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      // 서버 계산 금액으로 위젯 금액을 한 번 더 맞춘다
      if (typeof data.amount === 'number' && data.amount !== totalRef.current) {
        await widgetsRef.current.setAmount({
          currency: 'KRW',
          value: data.amount,
        });
      }

      // 2) 토스 결제창 호출 (성공/실패 시 리다이렉트)
      await widgetsRef.current.requestPayment({
        orderId: data.orderNo,
        orderName: data.orderName,
        successUrl: `${window.location.origin}/order/success`,
        failUrl: `${window.location.origin}/order/fail`,
        customerName: customerName.trim(),
        customerMobilePhone: normalizePhone(phone),
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'USER_CANCEL') {
        setSubmitError('결제를 취소하셨어요. 준비되시면 다시 눌러 주세요.');
      } else if (code === 'NEED_AGREEMENT_WITH_REQUIRED_TERMS') {
        setSubmitError('결제 진행을 위해 필수 약관에 동의해 주세요.');
      } else if (code === 'NOT_SELECTED_PAYMENT_METHOD') {
        setSubmitError('결제수단을 먼저 선택해 주세요.');
      } else if (code === 'NEED_CARD_PAYMENT_DETAIL') {
        setSubmitError('카드사와 할부 기간을 선택해 주세요.');
      } else {
        setSubmitError(
          '결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    validate,
    widgetReady,
    agreedRequiredTerms,
    selectedOption,
    quantity,
    customerName,
    phone,
    postcode,
    address1,
    address2,
    memo,
  ]);

  const payDisabled =
    submitting || available.length === 0 || !selectedOption;

  const payButtonLabel = submitting
    ? '결제 준비 중…'
    : total > 0
      ? `${formatWon(total)} 결제하기`
      : '결제하기';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <SectionTitle as="h1" sub="옵션과 배송 정보를 확인한 뒤 결제를 진행해 주세요.">
        {productName} 주문하기
      </SectionTitle>

      {/* 1. 옵션 선택 */}
      <Card id="order-section-option">
        <h2 className="text-lg font-bold tracking-tight text-ink">옵션 선택</h2>
        <div className="mt-4">
          {options.length === 0 ? (
            <p className="text-muted">
              지금은 주문 가능한 구성이 없습니다. 잠시 후 다시 확인해 주세요.
            </p>
          ) : (
            <OptionPicker
              options={options}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setErrors((prev) => ({ ...prev, option: undefined }));
              }}
            />
          )}
          {errors.option && (
            <p className="mt-2 text-sm font-medium text-danger">
              {errors.option}
            </p>
          )}
          {options.length > 0 && available.length === 0 && (
            <p className="mt-3 rounded-xl bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
              현재 모든 구성이 품절입니다. 다음 수확 시 다시 판매합니다.
            </p>
          )}
        </div>
        {available.length > 0 && (
          <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
            <span className="font-medium text-ink">수량</span>
            <QuantityStepper
              value={quantity}
              min={1}
              max={MAX_QUANTITY}
              onChange={setQuantity}
            />
          </div>
        )}
      </Card>

      {/* 2. 주문자 정보 */}
      <Card>
        <h2 className="text-lg font-bold tracking-tight text-ink">주문자 정보</h2>
        <div className="mt-4 flex flex-col gap-3">
          <Input
            id="order-input-name"
            label="성함"
            required
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="홍길동"
            autoComplete="name"
            error={errors.name}
          />
          <Input
            id="order-input-phone"
            label="연락처"
            required
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            placeholder="010-1234-5678"
            autoComplete="tel"
            hint="주문 확인과 배송 안내에 사용합니다."
            error={errors.phone}
          />
        </div>
      </Card>

      {/* 3. 배송지 */}
      <Card id="order-section-address">
        <h2 className="text-lg font-bold tracking-tight text-ink">배송지</h2>
        <div className="mt-4 flex flex-col gap-3">
          <AddressFields
            postcode={postcode}
            address1={address1}
            address2={address2}
            onAddressSelect={(nextPostcode, nextAddress1) => {
              setPostcode(nextPostcode);
              setAddress1(nextAddress1);
              setErrors((prev) => ({ ...prev, address: undefined }));
            }}
            onAddress2Change={setAddress2}
            error={errors.address}
          />
          <Textarea
            label="배송 메모"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 부재 시 문 앞에 놓아주세요"
            rows={2}
          />
        </div>
      </Card>

      {/* 4. 결제 수단 + 약관 (토스 결제위젯) */}
      {available.length > 0 && (
        <Card padding="none">
          <h2 className="px-5 pt-5 text-lg font-bold tracking-tight text-ink sm:px-6 sm:pt-6">
            결제 수단
          </h2>
          {widgetError ? (
            <div className="flex flex-col items-start gap-3 px-5 py-6 sm:px-6">
              <p className="text-ink/85">{widgetError}</p>
              <Button
                variant="outline"
                onClick={() => {
                  widgetInitStartedRef.current = false;
                  setWidgetError(null);
                  setWidgetReady(false);
                  setWidgetRetryKey((k) => k + 1);
                }}
              >
                결제 화면 다시 불러오기
              </Button>
            </div>
          ) : (
            <>
              {!widgetReady && (
                <p className="px-5 pt-3 text-sm text-muted sm:px-6">
                  결제 화면을 불러오는 중입니다…
                </p>
              )}
              <div id="toss-payment-methods" />
              <div id="toss-agreement" />
            </>
          )}
        </Card>
      )}

      {/* 5. 합계 + 결제 (데스크톱) */}
      <Card tone="light" className="hidden lg:block">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">
              {selectedOption
                ? `${productName} ${selectedOption.name} · ${quantity}개`
                : '옵션을 선택해 주세요'}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
              {formatWon(total)}
              <span className="ml-1 text-sm font-normal text-muted">
                배송비 포함
              </span>
            </p>
          </div>
          <Button size="lg" onClick={handlePay} disabled={payDisabled}>
            {payButtonLabel}
          </Button>
        </div>
        {submitError && (
          <p className="mt-3 text-sm font-medium text-danger" role="alert">
            {submitError}
          </p>
        )}
      </Card>

      {/* 하단 결제 바 (모바일) — sticky라 문서 끝까지 내리면 푸터가 온전히 드러난다 */}
      <div className="sticky bottom-0 z-40 -mx-4 border-t border-hairline bg-white/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {/* 검증 에러를 고정 바 안에도 표시해 버튼을 누른 자리에서 바로 보이게 한다 */}
          {submitError && (
            <p className="text-sm font-medium text-danger" role="alert">
              {submitError}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted">
                {selectedOption
                  ? `${selectedOption.name} · ${quantity}개`
                  : '옵션을 선택해 주세요'}
              </p>
              <p className="text-lg font-bold tabular-nums text-ink">
                {formatWon(total)}
              </p>
            </div>
            <Button
              size="lg"
              onClick={handlePay}
              disabled={payDisabled}
              className="shrink-0"
            >
              {submitting ? '결제 준비 중…' : '결제하기'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
