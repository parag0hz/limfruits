import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/db";
import type { Order } from "@/lib/types";
import { formatDateTime, formatPhone, formatWon } from "@/lib/format";
import { StatusBadge } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import ShipmentEditor from "@/components/admin/ShipmentEditor";
import GiftOrderActions from "@/components/admin/GiftOrderActions";
import { formatOrderTime, itemLabel } from "../../../order-utils";
import CopyButton from "./CopyButton";
import OrderActions from "./OrderActions";

export const metadata: Metadata = {
  title: "주문 상세",
};

export const dynamic = "force-dynamic";

/** 전화 걸기 아이콘 */
function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path d="M3.6 2.4c.5-.5 1.3-.5 1.8 0l2.1 2.1c.5.5.5 1.3 0 1.8l-1 1c-.2.2-.3.6-.1.9a12.4 12.4 0 0 0 5.4 5.4c.3.2.7.1.9-.1l1-1c.5-.5 1.3-.5 1.8 0l2.1 2.1c.5.5.5 1.3 0 1.8l-1 1c-.9.9-2.2 1.2-3.4.8A16.6 16.6 0 0 1 2.8 7.8c-.4-1.2 0-2.5.8-3.4l1-1z" />
    </svg>
  );
}

/** 전화 걸기 버튼 (큰 터치 타깃) */
function TelButton({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-dark"
    >
      <PhoneIcon />
      {formatPhone(phone)}
    </a>
  );
}

/** 결제 정보 카드 (단일·선물 공통) */
function PaymentInfoCard({ order }: { order: Order }) {
  return (
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
  );
}

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

  const isGift = order.kind === "GIFT";
  const allTracked =
    order.shipments.length > 0 &&
    order.shipments.every((s) => s.courier && s.trackingNo);
  // v2.9 — 할인 전 상품금액(쿠폰·포인트 차감 내역 표시용)
  const itemsSubtotal = order.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0
  );
  const isPaidLike =
    order.status === "PAID" ||
    order.status === "SHIPPING" ||
    order.status === "DONE";

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
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
          <div className="flex items-center gap-2">
            {isGift && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-base font-semibold text-brand-dark">
                선물 {order.shipments.length}건
              </span>
            )}
            <StatusBadge status={order.status} className="text-base" />
          </div>
        </div>
        <p className="mt-1 text-base text-muted">
          주문 시각: {formatOrderTime(order.createdAt)}
        </p>
      </div>

      {isGift ? (
        <>
          {/* 결제 금액 요약 */}
          <Card padding="sm">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">선물 주문</h2>
                <p className="mt-0.5 text-base text-muted">
                  배송 {order.shipments.length}건
                </p>
              </div>
              <p className="text-2xl font-bold text-brand-dark tabular-nums">
                {formatWon(order.totalAmount)}
              </p>
            </div>
          </Card>

          {/* 보내는 분 (주문자) */}
          <Card padding="sm">
            <h2 className="text-lg font-bold text-ink">보내는 분 (주문자)</h2>
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-bold text-ink">
                  {order.customerName}
                </p>
                <TelButton phone={order.phone} />
              </div>
              {order.memo && (
                <div>
                  <p className="text-base font-semibold text-muted">주문 메모</p>
                  <p className="mt-0.5 text-lg text-ink">{order.memo}</p>
                </div>
              )}
            </div>
          </Card>

          {/* 배송 건 목록 */}
          <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">
            배송 건 {order.shipments.length}건
          </h2>
          {order.shipments.map((s, i) => {
            const addr = [
              s.postcode ? `(${s.postcode})` : "",
              s.address1,
              s.address2,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <Card key={s.id} padding="sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-brand/10 px-2 text-base font-bold text-brand-dark tabular-nums">
                      {i + 1}
                    </span>
                    <p className="truncate text-xl font-bold text-ink">
                      {s.recipientName}
                    </p>
                  </div>
                  <TelButton phone={s.phone} />
                </div>

                {/* 주소 */}
                <div className="mt-3 rounded-xl bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg leading-relaxed text-ink">{addr}</p>
                    <CopyButton
                      text={addr}
                      label="주소 복사"
                      className="shrink-0"
                    />
                  </div>
                </div>

                {/* 구성 */}
                <div className="mt-3">
                  <p className="text-base font-semibold text-muted">구성</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {s.items.map((item, j) => (
                      <li
                        key={`${item.optionId}-${j}`}
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
                </div>

                {/* 선물 메시지 */}
                {s.giftMessage && (
                  <div className="mt-3">
                    <p className="text-base font-semibold text-muted">
                      선물 메시지
                    </p>
                    <p className="mt-1 rounded-xl bg-surface p-3 text-lg whitespace-pre-wrap text-ink">
                      {s.giftMessage}
                    </p>
                  </div>
                )}

                {/* 운송장 — 취소된 주문이 아니면 입력, 취소면 기존 값만 표시 */}
                {order.status === "CANCELED" ? (
                  (s.courier || s.trackingNo) && (
                    <div className="mt-3 border-t border-hairline pt-3">
                      <p className="text-base font-semibold text-muted">
                        운송장
                      </p>
                      <p className="mt-0.5 text-lg font-semibold text-ink">
                        {s.courier ?? ""} {s.trackingNo ?? ""}
                      </p>
                    </div>
                  )
                ) : (
                  <ShipmentEditor
                    orderNo={order.orderNo}
                    shipmentId={s.id}
                    courier={s.courier}
                    trackingNo={s.trackingNo}
                  />
                )}
              </Card>
            );
          })}

          <PaymentInfoCard order={order} />
        </>
      ) : (
        <>
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
            <div className="mt-3 border-t border-hairline pt-3">
              {(order.couponDiscount > 0 || order.pointsUsed > 0) && (
                <dl className="mb-2 flex flex-col gap-1 text-base">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">상품금액</dt>
                    <dd className="tabular-nums text-ink">
                      {formatWon(itemsSubtotal)}
                    </dd>
                  </div>
                  {order.couponDiscount > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">쿠폰 할인</dt>
                      <dd className="tabular-nums text-brand-dark">
                        −{formatWon(order.couponDiscount)}
                      </dd>
                    </div>
                  )}
                  {order.pointsUsed > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">포인트 사용</dt>
                      <dd className="tabular-nums text-brand-dark">
                        −{formatWon(order.pointsUsed)}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-bold text-ink">총 결제금액</p>
                <p className="text-2xl font-bold text-brand-dark tabular-nums">
                  {formatWon(order.totalAmount)}
                </p>
              </div>
              {order.userId && order.pointsEarned > 0 && (
                <p className="mt-1 text-right text-sm text-muted tabular-nums">
                  적립 {order.pointsEarned.toLocaleString("ko-KR")}P
                  {isPaidLike ? " 지급" : " 예정"}
                </p>
              )}
            </div>
          </Card>

          {/* 주문자 / 배송지 */}
          <Card padding="sm">
            <h2 className="text-lg font-bold text-ink">주문자 · 배송지</h2>
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xl font-bold text-ink">
                  {order.customerName}
                </p>
                <TelButton phone={order.phone} />
              </div>
              <div className="rounded-xl bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-lg leading-relaxed text-ink">
                    {[
                      order.postcode ? `(${order.postcode})` : "",
                      order.address1,
                      order.address2,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  <CopyButton
                    text={[
                      order.postcode ? `(${order.postcode})` : "",
                      order.address1,
                      order.address2,
                    ]
                      .filter(Boolean)
                      .join(" ")}
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

          <PaymentInfoCard order={order} />
        </>
      )}

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
      {isGift ? (
        <GiftOrderActions
          orderNo={order.orderNo}
          status={order.status}
          allTracked={allTracked}
          hasPaymentKey={order.paymentKey !== null}
        />
      ) : (
        <OrderActions
          orderNo={order.orderNo}
          status={order.status}
          courier={order.courier}
          trackingNo={order.trackingNo}
          hasPaymentKey={order.paymentKey !== null}
        />
      )}
    </div>
  );
}
