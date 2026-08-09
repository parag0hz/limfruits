'use client';

import { useState, type FormEvent } from 'react';
import type { OrderItem, OrderStatus } from '@/lib/types';
import { formatWon, formatDateTime } from '@/lib/format';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import OrderStatusTimeline from './OrderStatusTimeline';
import CopyButton from './CopyButton';
import ReviewForm from '@/components/review/ReviewForm';

/** v2.4 — 선물 주문의 배송 건(보내는 분에게 보이는 최소 정보) */
interface LookupShipment {
  recipientName: string;
  giftMessage: string;
  items: OrderItem[];
  courier: string | null;
  trackingNo: string | null;
}

/** GET /api/orders/lookup 응답의 주문 (내부 정보 제외 버전) */
interface LookupOrder {
  orderNo: string;
  kind?: 'SINGLE' | 'GIFT';
  status: OrderStatus;
  customerName: string;
  postcode: string;
  address1: string;
  address2: string;
  memo: string;
  items: OrderItem[];
  shipments?: LookupShipment[];
  totalAmount: number;
  paymentMethod: string | null;
  paidAt: string | null;
  courier: string | null;
  trackingNo: string | null;
  createdAt: string;
  /** v2.2 — 이 주문에 이미 리뷰가 있으면 true (SHIPPING/DONE 주문만 판단) */
  hasReview?: boolean;
}

/** "나주배 가정용 3kg" — 주문 시점 스냅샷 기준 표시명 */
function itemLabel(item: OrderItem): string {
  return item.productName
    ? `${item.productName} ${item.optionName}`
    : item.optionName;
}

export default function LookupForm({
  initialOrderNo = '',
}: {
  initialOrderNo?: string;
}) {
  const [orderNo, setOrderNo] = useState(initialOrderNo);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<LookupOrder | null>(null);
  // v2.2 리뷰 — 인라인 폼 확장 / 작성 완료 여부 (조회할 때마다 리셋)
  // lookupPhone: 조회에 실제로 사용한 연락처. 조회 후 입력값이 바뀌어도
  // 리뷰 제출은 인증에 성공한 값으로 보낸다 (URL 로는 절대 넘기지 않음)
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setReviewOpen(false);
    setReviewDone(false);

    if (!orderNo.trim()) {
      setError('주문번호를 입력해 주세요.');
      return;
    }
    if (!phone.trim()) {
      setError('주문하실 때 입력하신 연락처를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        orderNo: orderNo.trim(),
        phone: phone.trim(),
      });
      const res = await fetch(`/api/orders/lookup?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as {
        order?: LookupOrder;
        error?: string;
      };
      if (!res.ok || !data.order) {
        setError(
          data.error ??
            '주문을 찾지 못했어요. 주문번호와 연락처를 다시 확인해 주세요.'
        );
        return;
      }
      setOrder(data.order);
      setLookupPhone(phone.trim());
      // 이미 리뷰를 쓴 주문이면 "리뷰 작성 완료" 비활성 버튼을 바로 보여준다
      setReviewDone(data.order.hasReview === true);
    } catch {
      setError('조회 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 조회 폼 */}
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label="주문번호"
            required
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="LF-20260802-AB12CD34"
            autoComplete="off"
            hint="주문 완료 화면에서 안내드린 번호입니다."
          />
          <Input
            label="연락처"
            required
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            autoComplete="tel"
          />
          <Button type="submit" size="lg" disabled={loading} className="mt-1">
            {loading ? '조회 중…' : '주문 조회하기'}
          </Button>
          {error && (
            <p
              className="rounded-xl bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
              role="alert"
            >
              {error}
            </p>
          )}
        </form>
      </Card>

      {/* 조회 결과 */}
      {order && (
        <div className="flex flex-col gap-4" aria-live="polite">
          {/* 상태 */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">주문번호</p>
                <p className="text-lg font-bold tracking-tight text-ink">
                  {order.orderNo}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            {order.status === 'PENDING' && (
              <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm font-medium text-ink">
                아직 결제가 완료되지 않은 주문입니다. 결제를 마치지 않으셨다면
                다시 주문해 주세요.
              </p>
            )}
            {order.status === 'CANCELED' && (
              <p className="mt-4 rounded-xl bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
                취소된 주문입니다. 결제하신 금액은 결제수단에 따라 며칠 내로
                환불됩니다.
              </p>
            )}
            {(order.status === 'PAID' ||
              order.status === 'SHIPPING' ||
              order.status === 'DONE') && (
              <div className="mt-5">
                <OrderStatusTimeline status={order.status} />
              </div>
            )}
          </Card>

          {/* 운송장 — 선물(다중배송) 주문은 받는 분별로, 단일 주문은 하나로 */}
          {(order.status === 'SHIPPING' || order.status === 'DONE') &&
            (order.kind === 'GIFT' && order.shipments?.length ? (
              <Card tone="light">
                <h3 className="text-base font-bold tracking-tight text-ink">
                  선물 배송 정보
                </h3>
                <p className="mt-1 text-sm text-muted">
                  받는 분 {order.shipments.length}곳으로 보내는 선물의 배송
                  현황입니다.
                </p>
                <ul className="mt-3 flex flex-col gap-3">
                  {order.shipments.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-hairline bg-white p-3"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-bold text-ink">
                          {s.recipientName}
                        </span>
                        <span className="text-sm text-muted">
                          {s.items
                            .map((it) => `${itemLabel(it)} × ${it.quantity}`)
                            .join(', ')}
                        </span>
                      </div>
                      {s.courier && s.trackingNo ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">
                            {s.courier}
                          </span>
                          <span className="font-semibold tracking-wide tabular-nums text-ink">
                            {s.trackingNo}
                          </span>
                          <CopyButton text={s.trackingNo} label="운송장 복사" />
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted">
                          운송장 번호가 아직 등록되지 않았습니다.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <Card tone="light">
                <h3 className="text-base font-bold tracking-tight text-ink">
                  배송 정보
                </h3>
                {order.courier && order.trackingNo ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">
                      {order.courier}
                    </span>
                    <span className="font-semibold tracking-wide tabular-nums text-ink">
                      {order.trackingNo}
                    </span>
                    <CopyButton text={order.trackingNo} label="운송장 복사" />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    운송장 번호가 아직 등록되지 않았습니다. 등록되는 대로
                    확인하실 수 있습니다.
                  </p>
                )}
              </Card>
            ))}

          {/* 구매 후기 — 수령(SHIPPING/DONE) 후에만 작성 가능 */}
          {(order.status === 'SHIPPING' || order.status === 'DONE') && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-ink">
                    구매 후기
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    받으신 상품에 대한 후기를 남겨 주세요.
                  </p>
                </div>
                {reviewDone ? (
                  <Button disabled>리뷰 작성 완료</Button>
                ) : (
                  !reviewOpen && (
                    <Button onClick={() => setReviewOpen(true)}>
                      리뷰 쓰기
                    </Button>
                  )
                )}
              </div>
              {/* 닫았다 다시 열어도 입력값이 남도록 언마운트 대신 hidden 처리.
                  다른 주문을 조회하면 key 가 바뀌어 폼이 초기화된다 */}
              <div
                className={
                  reviewOpen ? 'mt-5 border-t border-hairline pt-5' : 'hidden'
                }
              >
                <ReviewForm
                  key={order.orderNo}
                  orderNo={order.orderNo}
                  phone={lookupPhone}
                  onSuccess={() => setReviewDone(true)}
                  // 다른 탭/기기에서 이미 작성한 경우(409): 폼을 닫지 않고
                  // 폼 안의 에러 안내를 그대로 보여준다 (닫으면 안내가 사라짐)
                  onDuplicate={() => setReviewDone(true)}
                  onClose={() => setReviewOpen(false)}
                />
              </div>
            </Card>
          )}

          {/* 주문 내역 */}
          <Card>
            <h3 className="text-base font-bold tracking-tight text-ink">
              주문 내역
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {order.items.map((item) => (
                <li
                  key={item.optionId}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-ink">
                    {itemLabel(item)}
                    <span className="ml-1.5 text-muted">× {item.quantity}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-ink">
                    {formatWon(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
              <span className="font-medium text-ink">결제 금액</span>
              <span className="text-xl font-bold tabular-nums text-ink">
                {formatWon(order.totalAmount)}
              </span>
            </div>
            <dl className="mt-3 flex flex-col gap-1 text-sm text-muted">
              <div className="flex justify-between">
                <dt>주문일시</dt>
                <dd>{formatDateTime(order.createdAt)}</dd>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <dt>결제일시</dt>
                  <dd>{formatDateTime(order.paidAt)}</dd>
                </div>
              )}
              {order.paymentMethod && (
                <div className="flex justify-between">
                  <dt>결제수단</dt>
                  <dd>{order.paymentMethod}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* 배송지 */}
          <Card>
            <h3 className="text-base font-bold tracking-tight text-ink">
              배송지
            </h3>
            <p className="mt-3 text-ink">
              {order.customerName} · ({order.postcode}) {order.address1}
              {order.address2 && ` ${order.address2}`}
            </p>
            {order.memo && (
              <p className="mt-1.5 text-sm text-muted">메모: {order.memo}</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
