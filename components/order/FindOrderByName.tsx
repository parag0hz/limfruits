'use client';

import { useState, type FormEvent } from 'react';
import type { OrderStatus } from '@/lib/types';
import { formatWon, formatDateTime } from '@/lib/format';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import CopyButton from './CopyButton';

interface FoundShipment {
  recipientName: string;
  courier: string | null;
  trackingNo: string | null;
}

interface FoundOrder {
  orderNo: string;
  kind: 'SINGLE' | 'GIFT';
  status: OrderStatus;
  createdAt: string;
  totalAmount: number;
  itemsSummary: string;
  courier: string | null;
  trackingNo: string | null;
  shipments: FoundShipment[];
}

/**
 * v2.9 — 주문번호를 잊었을 때: 성함 + 연락처(둘 다 일치)로 본인 주문을 찾는다.
 * 주소 등 민감정보는 빼고 주문번호·상태·운송장만 보여준다(약한 인증).
 * 전체 상세(배송지 등)는 위쪽 '주문번호 + 연락처' 조회로 확인.
 */
export default function FindOrderByName() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<FoundOrder[] | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrders(null);
    if (!name.trim()) {
      setError('주문하실 때 입력하신 성함을 입력해 주세요.');
      return;
    }
    if (!phone.trim()) {
      setError('연락처를 입력해 주세요.');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        name: name.trim(),
        phone: phone.trim(),
      });
      const res = await fetch(`/api/orders/find?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as {
        orders?: FoundOrder[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? '조회 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setOrders(data.orders ?? []);
    } catch {
      setError('조회 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-bold tracking-tight text-ink">
        주문번호를 잊으셨나요?
      </h2>
      <p className="mt-1 text-sm text-muted">
        주문하실 때 입력하신 <b>성함과 연락처</b>로 주문번호를 찾아드려요.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <Input
          label="성함"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          autoComplete="name"
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
        <Button
          type="submit"
          variant="outline"
          size="lg"
          disabled={loading}
          className="mt-1"
        >
          {loading ? '찾는 중…' : '내 주문 찾기'}
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

      {orders !== null && (
        <div className="mt-5 border-t border-hairline pt-5" aria-live="polite">
          {orders.length === 0 ? (
            <p className="text-sm text-muted">
              일치하는 주문이 없어요. 성함·연락처를 다시 확인해 주세요. 계속
              찾을 수 없으면 판매자(010-2618-5151)에게 문의해 주세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {orders.map((o) => (
                <li
                  key={o.orderNo}
                  className="rounded-xl border border-hairline p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold tabular-nums text-ink">
                        {o.orderNo}
                      </span>
                      <CopyButton text={o.orderNo} label="번호 복사" />
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm text-ink">
                      {o.kind === 'GIFT' && (
                        <span className="mr-1 font-medium text-brand">선물</span>
                      )}
                      {o.itemsSummary}
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-ink">
                      {formatWon(o.totalAmount)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(o.createdAt)}
                  </p>

                  {/* 배송 정보 (수령 단계) */}
                  {(o.status === 'SHIPPING' || o.status === 'DONE') && (
                    <div className="mt-3 border-t border-hairline pt-3">
                      {o.kind === 'GIFT' && o.shipments.length > 0 ? (
                        <ul className="flex flex-col gap-1.5">
                          {o.shipments.map((s, i) => (
                            <li
                              key={i}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <span className="font-medium text-ink">
                                {s.recipientName}
                              </span>
                              {s.courier && s.trackingNo ? (
                                <span className="flex items-center gap-2">
                                  <span className="text-muted">{s.courier}</span>
                                  <span className="font-semibold tabular-nums text-ink">
                                    {s.trackingNo}
                                  </span>
                                  <CopyButton text={s.trackingNo} label="복사" />
                                </span>
                              ) : (
                                <span className="text-muted">운송장 준비 중</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : o.courier && o.trackingNo ? (
                        <span className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-muted">{o.courier}</span>
                          <span className="font-semibold tabular-nums text-ink">
                            {o.trackingNo}
                          </span>
                          <CopyButton text={o.trackingNo} label="운송장 복사" />
                        </span>
                      ) : (
                        <span className="text-sm text-muted">운송장 준비 중</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
              <p className="text-xs text-muted">
                찾으신 주문번호로 위쪽에서 배송지 등 전체 상세를 확인하실 수
                있어요.
              </p>
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
