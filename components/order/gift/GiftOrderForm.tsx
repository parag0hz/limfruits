'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadTossPayments,
  ANONYMOUS,
  type TossPaymentsWidgets,
  type WidgetPaymentMethodWidget,
  type WidgetAgreementWidget,
} from '@tosspayments/tosspayments-sdk';
import { formatWon, normalizePhone } from '@/lib/format';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import SectionTitle from '@/components/ui/SectionTitle';
import RecipientCard from './RecipientCard';
import BulkUpload from './BulkUpload';
import type {
  OptionChoice,
  ProductLite,
  RecipientDraft,
  RecipientErrors,
} from './types';

/**
 * 결제위젯 연동용 문서 공개 테스트 클라이언트 키.
 * (OrderForm과 동일 — 테스트 전용 공개 키, 실 결제 없음. 운영 전 교체)
 */
const DOCS_TEST_CLIENT_KEY = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const CLIENT_KEY =
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || DOCS_TEST_CLIENT_KEY;

const MAX_RECIPIENTS = 100;
const MAX_QUANTITY = 99;

export interface GiftOrderFormProps {
  products: ProductLite[];
  options: OptionChoice[];
}

let recipientCounter = 0;

function emptyDraft(key: string, optionId: string): RecipientDraft {
  return {
    key,
    optionId,
    quantity: 1,
    recipientName: '',
    phone: '',
    postcode: '',
    address1: '',
    address2: '',
    giftMessage: '',
  };
}

interface FormErrors {
  senderName?: string;
  senderPhone?: string;
  recipients: Record<string, RecipientErrors>;
}

export default function GiftOrderForm({
  products,
  options,
}: GiftOrderFormProps) {
  const hasChoices = options.length > 0;
  const firstOptionId = options[0]?.id ?? '';

  const makeKey = useCallback(() => `r${recipientCounter++}`, []);

  // 초기 카드 1건 — SSR/hydration 안정 위해 고정 키 사용
  const [recipients, setRecipients] = useState<RecipientDraft[]>(() => [
    emptyDraft('r-initial', firstOptionId),
  ]);
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');

  const [errors, setErrors] = useState<FormErrors>({ recipients: {} });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 상점 동의 (토스 결제위젯 약관과 별개) — v2.7. 선물주문은 보내는 분(주문자) 동의로 저장
  const [storeAgreed, setStoreAgreed] = useState(false); // [필수] 미체크 시 결제 차단
  const [marketingAgreed, setMarketingAgreed] = useState(false); // [선택] marketingConsent
  const [consentError, setConsentError] = useState(false);

  const optionMap = useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options]
  );

  const total = useMemo(
    () =>
      recipients.reduce((sum, r) => {
        const o = optionMap.get(r.optionId);
        return sum + (o ? o.price * r.quantity : 0);
      }, 0),
    [recipients, optionMap]
  );
  const totalRef = useRef(total);

  // ── 토스 결제위젯 (OrderForm과 동일 패턴, 결제 코어는 미수정) ──
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const paymentMethodWidgetRef = useRef<WidgetPaymentMethodWidget | null>(null);
  const agreementWidgetRef = useRef<WidgetAgreementWidget | null>(null);
  const widgetInitStartedRef = useRef(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [widgetRetryKey, setWidgetRetryKey] = useState(0);
  const [agreedRequiredTerms, setAgreedRequiredTerms] = useState(true);

  useEffect(() => {
    if (!hasChoices) return;
    if (widgetInitStartedRef.current) return;
    widgetInitStartedRef.current = true;

    (async () => {
      try {
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
          value: Math.max(totalRef.current, 1),
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
  }, [hasChoices, widgetRetryKey]);

  // 합계가 바뀌면 위젯 금액 갱신
  useEffect(() => {
    totalRef.current = total;
    if (!widgetReady || total <= 0) return;
    widgetsRef.current
      ?.setAmount({ currency: 'KRW', value: total })
      .catch(() => {});
  }, [total, widgetReady]);

  // ── 받는 분 카드 조작 ──
  const patchRecipient = useCallback(
    (key: string, patch: Partial<RecipientDraft>) => {
      setRecipients((prev) =>
        prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const clearRecipientError = useCallback(
    (key: string, field: keyof RecipientErrors) => {
      setErrors((prev) => {
        const cur = prev.recipients[key];
        if (!cur || cur[field] === undefined) return prev;
        const nextCur = { ...cur, [field]: undefined };
        return {
          ...prev,
          recipients: { ...prev.recipients, [key]: nextCur },
        };
      });
    },
    []
  );

  const addRecipient = useCallback(() => {
    setRecipients((prev) => {
      if (prev.length >= MAX_RECIPIENTS) return prev;
      return [...prev, emptyDraft(makeKey(), firstOptionId)];
    });
  }, [makeKey, firstOptionId]);

  const removeRecipient = useCallback((key: string) => {
    setRecipients((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)
    );
  }, []);

  const addBulk = useCallback((drafts: RecipientDraft[]) => {
    setRecipients((prev) => {
      const room = MAX_RECIPIENTS - prev.length;
      const toAdd = drafts.slice(0, Math.max(room, 0));
      return [...prev, ...toAdd];
    });
  }, []);

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = { recipients: {} };

    if (!senderName.trim()) {
      next.senderName = '보내는 분 성함을 입력해 주세요.';
    } else if (senderName.trim().length > 30) {
      next.senderName = '성함은 30자 이내로 입력해 주세요.';
    }
    const senderDigits = normalizePhone(senderPhone);
    if (!senderDigits) {
      next.senderPhone = '보내는 분 연락처를 입력해 주세요.';
    } else if (
      senderDigits.length < 10 ||
      senderDigits.length > 11 ||
      !senderDigits.startsWith('0')
    ) {
      next.senderPhone = '연락처를 정확히 입력해 주세요. 예: 010-1234-5678';
    }

    for (const r of recipients) {
      const re: RecipientErrors = {};
      const option = optionMap.get(r.optionId);
      if (!option) {
        re.option = '상품 구성을 선택해 주세요.';
      }
      if (!r.recipientName.trim()) {
        re.name = '받는 분 성함을 입력해 주세요.';
      } else if (r.recipientName.trim().length > 30) {
        re.name = '성함은 30자 이내로 입력해 주세요.';
      }
      const digits = normalizePhone(r.phone);
      if (!digits) {
        re.phone = '연락처를 입력해 주세요.';
      } else if (
        digits.length < 10 ||
        digits.length > 11 ||
        !digits.startsWith('0')
      ) {
        re.phone = '연락처를 정확히 입력해 주세요. 예: 010-1234-5678';
      }
      if (!r.postcode || !r.address1.trim()) {
        re.address = '주소검색으로 배송지 주소를 입력해 주세요.';
      }
      if (r.giftMessage.length > 200) {
        re.message = '선물 메시지는 200자 이내로 입력해 주세요.';
      }
      if (Object.keys(re).length > 0) {
        next.recipients[r.key] = re;
      }
    }

    return next;
  }, [senderName, senderPhone, recipients, optionMap]);

  const scrollToFirstError = useCallback(
    (errs: FormErrors) => {
      // 받는 분 카드 에러 우선, 없으면 보내는 분
      const firstBad = recipients.find((r) => errs.recipients[r.key]);
      if (firstBad) {
        document
          .getElementById(`gift-recipient-${firstBad.key}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (errs.senderName || errs.senderPhone) {
        document
          .getElementById('gift-sender')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    [recipients]
  );

  const handlePay = useCallback(async () => {
    setSubmitError(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    const hasError =
      !!nextErrors.senderName ||
      !!nextErrors.senderPhone ||
      Object.keys(nextErrors.recipients).length > 0;
    if (hasError) {
      setSubmitError('입력하지 않은 항목이 있어요. 위 내용을 확인해 주세요.');
      scrollToFirstError(nextErrors);
      return;
    }
    if (recipients.length === 0) {
      setSubmitError('받는 분을 한 명 이상 추가해 주세요.');
      return;
    }
    // 상점 필수 동의 (개인정보 수집·이용/이용약관/개인정보처리방침) — 미체크 시 결제 차단
    if (!storeAgreed) {
      setConsentError(true);
      setSubmitError(
        '결제 진행을 위해 필수 동의 항목에 동의해 주세요.'
      );
      document
        .getElementById('gift-consent')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      const res = await fetch('/api/orders/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: senderName.trim(),
          senderPhone: normalizePhone(senderPhone),
          memo: '',
          marketingConsent: marketingAgreed,
          shipments: recipients.map((r) => ({
            recipientName: r.recipientName.trim(),
            phone: normalizePhone(r.phone),
            postcode: r.postcode,
            address1: r.address1.trim(),
            address2: r.address2.trim(),
            giftMessage: r.giftMessage.trim(),
            optionId: r.optionId,
            quantity: r.quantity,
          })),
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

      if (typeof data.amount === 'number' && data.amount !== totalRef.current) {
        await widgetsRef.current.setAmount({
          currency: 'KRW',
          value: data.amount,
        });
      }

      await widgetsRef.current.requestPayment({
        orderId: data.orderNo,
        orderName: data.orderName,
        successUrl: `${window.location.origin}/order/success`,
        failUrl: `${window.location.origin}/order/fail`,
        customerName: senderName.trim(),
        customerMobilePhone: normalizePhone(senderPhone),
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
        setSubmitError('결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    validate,
    scrollToFirstError,
    recipients,
    widgetReady,
    agreedRequiredTerms,
    storeAgreed,
    marketingAgreed,
    senderName,
    senderPhone,
  ]);

  const payDisabled = submitting || !hasChoices || total <= 0;
  const payLabel = submitting
    ? '결제 준비 중…'
    : total > 0
      ? `${formatWon(total)} 결제하기`
      : '결제하기';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <SectionTitle
        as="h1"
        sub="받는 분마다 구성을 담아 한 번에 결제하세요. 각 세트 가격에 배송비가 포함됩니다."
      >
        선물·대량 주문
      </SectionTitle>

      {!hasChoices ? (
        <Card>
          <p className="text-muted">
            지금은 주문 가능한 구성이 없습니다. 잠시 후 다시 확인해 주세요.
          </p>
        </Card>
      ) : (
        <>
          {/* 엑셀 대량 업로드 */}
          <Card>
            <h2 className="text-lg font-bold tracking-tight text-ink">
              엑셀로 한 번에 담기
            </h2>
            <div className="mt-4">
              <BulkUpload
                options={options}
                remainingSlots={MAX_RECIPIENTS - recipients.length}
                makeKey={makeKey}
                onAdd={addBulk}
              />
            </div>
          </Card>

          {/* 받는 분 카드 목록 */}
          <div className="flex flex-col gap-4">
            {recipients.map((r, i) => (
              <RecipientCard
                key={r.key}
                index={i}
                draft={r}
                products={products}
                options={options}
                errors={errors.recipients[r.key]}
                removable={recipients.length > 1}
                onChange={patchRecipient}
                onRemove={removeRecipient}
                onClearError={clearRecipientError}
              />
            ))}
          </div>

          <Button
            variant="outline"
            onClick={addRecipient}
            disabled={recipients.length >= MAX_RECIPIENTS}
            className="w-full"
          >
            받는 분 추가
          </Button>
          <p className="-mt-2 text-center text-sm text-muted">
            받는 분 {recipients.length}명 · 최대 {MAX_RECIPIENTS}명
          </p>

          {/* 보내는 분 */}
          <Card id="gift-sender">
            <h2 className="text-lg font-bold tracking-tight text-ink">
              보내는 분
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <Input
                label="성함"
                required
                value={senderName}
                onChange={(e) => {
                  setSenderName(e.target.value);
                  setErrors((prev) => ({ ...prev, senderName: undefined }));
                }}
                placeholder="홍길동"
                autoComplete="name"
                error={errors.senderName}
              />
              <Input
                label="연락처"
                required
                type="tel"
                inputMode="numeric"
                value={senderPhone}
                onChange={(e) => {
                  setSenderPhone(e.target.value);
                  setErrors((prev) => ({ ...prev, senderPhone: undefined }));
                }}
                placeholder="010-1234-5678"
                autoComplete="tel"
                hint="주문 확인 안내에 사용합니다."
                error={errors.senderPhone}
              />
            </div>
          </Card>

          {/* 결제 수단 + 약관 (토스 결제위젯) */}
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

          {/* 상점 동의 (토스 결제위젯 약관과 별개) */}
          <Card id="gift-consent">
            <h2 className="text-lg font-bold tracking-tight text-ink">
              주문 동의
            </h2>
            <div className="mt-3 flex flex-col">
              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1.5">
                <input
                  type="checkbox"
                  checked={storeAgreed}
                  onChange={(e) => {
                    setStoreAgreed(e.target.checked);
                    if (e.target.checked) {
                      setConsentError(false);
                      setSubmitError(null);
                    }
                  }}
                  aria-invalid={consentError}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                />
                <span className="text-sm leading-relaxed text-ink">
                  <span className="font-semibold text-brand">[필수]</span> 주문
                  내용을 확인했으며, 개인정보 수집·이용 및{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline underline-offset-2"
                  >
                    이용약관
                  </a>
                  ·
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline underline-offset-2"
                  >
                    개인정보처리방침
                  </a>
                  에 동의합니다.
                </span>
              </label>
              {consentError && (
                <p
                  className="pl-8 text-sm font-medium text-danger"
                  role="alert"
                >
                  필수 동의 항목에 동의해 주셔야 결제를 진행할 수 있어요.
                </p>
              )}
              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1.5">
                <input
                  type="checkbox"
                  checked={marketingAgreed}
                  onChange={(e) => setMarketingAgreed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                />
                <span className="text-sm leading-relaxed text-ink">
                  <span className="font-semibold text-muted">[선택]</span> 광고성
                  정보(문자) 수신에 동의합니다. 명절·행사 소식을 보내드립니다.
                </span>
              </label>
            </div>
          </Card>

          {/* 합계 + 결제 (데스크톱) */}
          <Card tone="light" className="hidden lg:block">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">
                  받는 분 {recipients.length}명 · 배송 {recipients.length}건
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
                  {formatWon(total)}
                  <span className="ml-1 text-sm font-normal text-muted">
                    배송비 포함
                  </span>
                </p>
              </div>
              <Button size="lg" onClick={handlePay} disabled={payDisabled}>
                {payLabel}
              </Button>
            </div>
            {submitError && (
              <p className="mt-3 text-sm font-medium text-danger" role="alert">
                {submitError}
              </p>
            )}
          </Card>

          {/* 하단 고정 결제 바 (모바일) */}
          <div className="sticky bottom-0 z-40 -mx-4 border-t border-hairline bg-white/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
            <div className="mx-auto flex max-w-2xl flex-col gap-2">
              {submitError && (
                <p className="text-sm font-medium text-danger" role="alert">
                  {submitError}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted">
                    받는 분 {recipients.length}명 · 배송 {recipients.length}건
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
        </>
      )}
    </div>
  );
}
