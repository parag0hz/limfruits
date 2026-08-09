import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/db";
import type { Order, OrderStatus } from "@/lib/types";
import { formatWon } from "@/lib/format";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import {
  formatOrderTime,
  summarizeItems,
  summarizeRecipients,
} from "../order-utils";
import RefreshButton from "./RefreshButton";
import ShippingTools from "./ShippingTools";

export const metadata: Metadata = {
  title: "주문 목록",
};

export const dynamic = "force-dynamic";

type TabKey = "PAID" | "SHIPPING" | "DONE" | "PENDING" | "CANCELED" | "ALL";

const TABS: { key: TabKey; label: string }[] = [
  { key: "PAID", label: "신규주문" },
  { key: "SHIPPING", label: "배송중" },
  { key: "DONE", label: "완료" },
  { key: "PENDING", label: "결제대기" },
  { key: "CANCELED", label: "취소" },
  { key: "ALL", label: "전체" },
];

function parseTab(raw: string | undefined): TabKey {
  const upper = (raw ?? "").toUpperCase();
  const found = TABS.find((t) => t.key === upper);
  return found ? found.key : "PAID";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const tab = parseTab(status);

  const store = getStore();
  const allOrders = await store.listOrders();

  const counts: Record<TabKey, number> = {
    PAID: 0,
    SHIPPING: 0,
    DONE: 0,
    PENDING: 0,
    CANCELED: 0,
    ALL: allOrders.length,
  };
  for (const o of allOrders) {
    counts[o.status as Exclude<TabKey, "ALL">] += 1;
  }

  const orders =
    tab === "ALL"
      ? allOrders
      : allOrders.filter((o) => o.status === (tab as OrderStatus));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          주문 목록
        </h1>
        <RefreshButton />
      </div>

      {/* 상태 필터 탭 */}
      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-2" role="tablist" aria-label="주문 상태 필터">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={t.key === "PAID" ? "/admin" : `/admin?status=${t.key}`}
                role="tab"
                aria-selected={active}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-base font-semibold whitespace-nowrap transition-colors",
                  active
                    ? "bg-brand text-white"
                    : "border border-hairline bg-white text-ink hover:bg-surface"
                )}
              >
                {t.label}
                {t.key === "PAID" && counts.PAID > 0 && (
                  <span
                    className={cn(
                      "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-bold tabular-nums",
                      active ? "bg-white/25 text-white" : "bg-danger text-white"
                    )}
                  >
                    {counts.PAID}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 송장 도구 — 신규주문 탭에서만 (엑셀 왕복으로 로젠 송장 출력) */}
      {tab === "PAID" && <ShippingTools paidCount={counts.PAID} />}

      {/* 주문 카드 목록 */}
      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-hairline bg-surface px-5 py-12 text-center">
          <p className="text-xl font-bold text-ink">
            {tab === "PAID"
              ? "새로 들어온 주문이 없습니다."
              : "해당하는 주문이 없습니다."}
          </p>
          <p className="mt-2 text-base text-muted">
            새 주문이 왔는지 보려면 위의 새로고침을 눌러 주세요.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const isGift = order.kind === "GIFT";
  return (
    <Link
      href={`/admin/orders/${order.orderNo}`}
      className="block rounded-2xl border border-hairline bg-white p-4 transition-colors hover:bg-surface active:bg-surface"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold text-ink">
            {order.customerName}
            <span className="ml-2 text-base font-medium text-muted">
              {formatOrderTime(order.createdAt)}
            </span>
          </p>
          <p className="mt-1 truncate text-lg text-ink">
            {isGift
              ? `받는 분 ${summarizeRecipients(order)}`
              : summarizeItems(order.items)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={order.status} />
          {isGift && (
            <Badge tone="green">선물 {order.shipments.length}건</Badge>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xl font-bold text-brand-dark tabular-nums">
          {formatWon(order.totalAmount)}
        </p>
        <span
          aria-hidden="true"
          className="text-base font-semibold text-brand-dark"
        >
          자세히 &gt;
        </span>
      </div>
    </Link>
  );
}
