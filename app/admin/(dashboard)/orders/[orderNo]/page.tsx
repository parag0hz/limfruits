import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/db";
import { formatDateTime, formatPhone, formatWon } from "@/lib/format";
import { StatusBadge } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { formatOrderTime, itemLabel } from "../../../order-utils";
import CopyButton from "./CopyButton";
import OrderActions from "./OrderActions";

export const metadata: Metadata = {
  title: "주문 상세",
};

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo: rawOrderNo } = await params;
  const store = getStore();
  // Next가 이미 percent-decode한 값이라 재디코딩 실패("100%" 등) 시 원문을 사용 (500 방지)
  let orderNo = rawOrderNo;
  try {
    orderNo = decodeURIComponent(rawOrderNo);
  } catch {
    // 원문 그대로 사용
  }
  const order = await store.getOrderByNo(orderNo);

  if (!order) {
    return (
      <div className="py-10 text-center">
        <p className="text-xl font-bold text-ink">주문을 찾을 수 없습니다.</p>
        <Link
          href="/admin"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full border border-hairline bg-white px-6 text-lg font-semibold text-ink transition-colors hover:bg-surface"
        >
          주문 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  // v2.2: 이 주문에 리뷰가 있으면 리뷰 관리로 바로가기 링크 표시
  const review = await store.getReviewByOrderNo(order.orderNo);

  const fullAddress = [
    order.postcode ? `(${order.postcode})` : "",
    order.address1,
    order.address2,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-1 text-lg font-semibold text-brand-dark hover:underline"
        >
          &lt; 주문 목록
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {order.orderNo}
          </h1>
          <StatusBadge status={order.status} className="text-base" />
        </div>
        <p className="mt-1 text-base text-muted">
          주문 시각: {formatOrderTime(order.createdAt)}
        </p>
      </div>

      {/* 주문 상품 */}
      <Card padding="sm">
        <h2 className="text-lg font-bold text-ink">주문 상품</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {order.items.map((item, i) => (
            <li
              key={`${item.optionId}-${i}`}
              className="flex items-baseline justify-between gap-3"
            >
              <p className="text-lg text-ink">
                {itemLabel(item)}{" "}
                <span className="font-bold">× {item.quantity}</span>
              </p>
              <p className="shrink-0 text-lg font-bold text-ink tabular-nums">
                {formatWon(item.unitPrice * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
          <p className="text-lg font-bold text-ink">총 결제금액</p>
          <p className="text-2xl font-bold text-brand-dark tabular-nums">
            {formatWon(order.totalAmount)}
          </p>
        </div>
      </Card>

      {/* 주문자 / 배송지 */}
      <Card padding="sm">
        <h2 className="text-lg font-bold text-ink">주문자 · 배송지</h2>
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xl font-bold text-ink">{order.customerName}</p>
            <a
              href={`tel:${order.phone}`}
              className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-dark"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M3.6 2.4c.5-.5 1.3-.5 1.8 0l2.1 2.1c.5.5.5 1.3 0 1.8l-1 1c-.2.2-.3.6-.1.9a12.4 12.4 0 0 0 5.4 5.4c.3.2.7.1.9-.1l1-1c.5-.5 1.3-.5 1.8 0l2.1 2.1c.5.5.5 1.3 0 1.8l-1 1c-.9.9-2.2 1.2-3.4.8A16.6 16.6 0 0 1 2.8 7.8c-.4-1.2 0-2.5.8-3.4l1-1z" />
              </svg>
              {formatPhone(order.phone)}
            </a>
          </div>
          <div className="rounded-xl bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg leading-relaxed text-ink">{fullAddress}</p>
              <CopyButton
                text={fullAddress}
                label="주소 복사"
                className="shrink-0"
              />
            </div>
          </div>
          {order.memo && (
            <div>
              <p className="text-base font-semibold text-muted">배송 메모</p>
              <p className="mt-0.5 text-lg text-ink">{order.memo}</p>
            </div>
          )}
        </div>
      </Card>

      {/* 결제 정보 */}
      <Card padding="sm">
        <h2 className="text-lg font-bold text-ink">결제 정보</h2>
        <dl className="mt-2 flex flex-col gap-1.5 text-lg">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">결제 수단</dt>
            <dd className="font-semibold text-ink">
              {order.paymentMethod ?? "결제 전"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">결제 시각</dt>
            <dd className="font-semibold text-ink">
              {order.paidAt ? formatDateTime(order.paidAt) : "-"}
            </dd>
          </div>
          {(order.courier || order.trackingNo) && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">운송장</dt>
              <dd className="text-right font-semibold text-ink">
                {order.courier ?? ""} {order.trackingNo ?? ""}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {/* 이 주문의 리뷰 (v2.2) */}
      {review && (
        <Link
          href={`/admin/reviews#review-${review.id}`}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-hairline bg-white px-6 text-lg font-semibold text-brand-dark transition-colors hover:bg-surface"
        >
          이 주문의 리뷰 보기
        </Link>
      )}

      {/* 상태 변경 액션 */}
      <OrderActions
        orderNo={order.orderNo}
        status={order.status}
        courier={order.courier}
        trackingNo={order.trackingNo}
        hasPaymentKey={order.paymentKey !== null}
      />
    </div>
  );
}
