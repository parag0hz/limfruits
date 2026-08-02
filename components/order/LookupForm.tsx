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

/** GET /api/orders/lookup 응답의 주문 (내부 정보 제외 버전) */
interface LookupOrder {
  orderNo: string;
  status: OrderStatus;
  customerName: string;
  postcode: string;
  address1: string;
  address2: string;
  memo: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: string | null;
  paidAt: string | null;
  courier: string | null;
  trackingNo: string | null;
  createdAt: string;
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);

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
            hint="주문 완료 화면에서 안내해 드린 번호예요."
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
              className="rounded-xl bg-accent-red/10 px-4 py-3 text-sm font-medium text-accent-red"
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
                <p className="text-sm text-ink/60">주문번호</p>
                <p className="font-heading text-xl text-brand-dark">
                  {order.orderNo}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            {order.status === 'PENDING' && (
              <p className="mt-4 rounded-xl bg-accent-yellow/25 px-4 py-3 text-sm font-medium text-ink">
                아직 결제가 완료되지 않은 주문이에요. 결제를 마치지 않으셨다면
                다시 주문해 주세요.
              </p>
            )}
            {order.status === 'CANCELED' && (
              <p className="mt-4 rounded-xl bg-accent-red/10 px-4 py-3 text-sm font-medium text-accent-red">
                취소된 주문이에요. 결제하신 금액은 결제수단에 따라 며칠 내로
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

          {/* 운송장 */}
          {(order.status === 'SHIPPING' || order.status === 'DONE') && (
            <Card tone="light">
              <h3 className="font-heading text-lg text-brand-dark">
                배송 정보
              </h3>
              {order.courier && order.trackingNo ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{order.courier}</span>
                  <span className="font-bold tracking-wide text-ink">
                    {order.trackingNo}
                  </span>
                  <CopyButton text={order.trackingNo} label="운송장 복사" />
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink/70">
                  운송장 번호가 아직 등록되지 않았어요. 조금만 기다려 주세요.
                </p>
              )}
            </Card>
          )}

          {/* 주문 내역 */}
          <Card>
            <h3 className="font-heading text-lg text-brand-dark">주문 내역</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {order.items.map((item) => (
                <li
                  key={item.optionId}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-ink">
                    {item.optionName}
                    <span className="ml-1.5 text-ink/60">
                      × {item.quantity}
                    </span>
                  </span>
                  <span className="font-bold text-ink">
                    {formatWon(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t-2 border-brand/15 pt-4">
              <span className="font-bold text-ink">결제 금액</span>
              <span className="text-xl font-bold text-brand-dark">
                {formatWon(order.totalAmount)}
              </span>
            </div>
            <dl className="mt-3 flex flex-col gap-1 text-sm text-ink/70">
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
            <h3 className="font-heading text-lg text-brand-dark">배송지</h3>
            <p className="mt-3 text-ink">
              {order.customerName} · ({order.postcode}) {order.address1}
              {order.address2 && ` ${order.address2}`}
            </p>
            {order.memo && (
              <p className="mt-1.5 text-sm text-ink/60">메모: {order.memo}</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
