import type { Metadata } from "next";
import Link from "next/link";
import { kakaoConfigured, getUserSession } from "@/lib/user-auth";
import { getStore } from "@/lib/db";
import type { Order, OrderItem } from "@/lib/types";
import { formatWon, formatDateTime } from "@/lib/format";
import SectionTitle from "@/components/ui/SectionTitle";
import Card from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import OrderStatusTimeline from "@/components/order/OrderStatusTimeline";
import CopyButton from "@/components/order/CopyButton";
import KakaoLoginButton from "@/components/auth/KakaoLoginButton";
import LogoutButton from "@/components/auth/LogoutButton";

export const metadata: Metadata = {
  title: "마이페이지",
  description: "로그인한 계정의 주문 내역과 배송 현황을 확인하세요.",
};

// 로그인 계정별 주문 내역을 렌더하는 개인화 페이지 — 절대 정적 캐시하지 않는다.
// (카카오 키가 없을 땐 로그인 안내만 뜨지만, 키가 있으면 유저별로 달라지므로
//  요청마다 세션·주문을 새로 읽도록 동적 렌더로 고정한다.)
export const dynamic = "force-dynamic";

/** "나주배 가정용 3kg" — 주문 시점 스냅샷 기준 표시명 */
function itemLabel(item: OrderItem): string {
  return item.productName
    ? `${item.productName} ${item.optionName}`
    : item.optionName;
}

/** "나주배 가정용 3kg 외 2건" 형태의 상품 요약 */
function itemsSummary(order: Order): string {
  const items = order.items;
  if (!items.length) return "주문 상품";
  const first = itemLabel(items[0]);
  return items.length > 1 ? `${first} 외 ${items.length - 1}건` : first;
}

export default async function MyPage() {
  const configured = kakaoConfigured();
  const session = configured ? await getUserSession() : null;

  if (!session) {
    return <LoggedOut configured={configured} />;
  }

  const store = getStore();
  const [user, orders] = await Promise.all([
    store.getUser(session.userId),
    store.listOrdersByUser(session.userId),
  ]);

  // 세션은 있으나 유저 레코드가 없으면(삭제 등) 로그인 안내로 강등
  if (!user) {
    return <LoggedOut configured={configured} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle as="h1" sub={`${user.nickname || "고객"}님, 안녕하세요.`}>
          마이페이지
        </SectionTitle>
        <LogoutButton />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold tracking-tight text-ink">주문 내역</h2>

        {orders.length === 0 ? (
          <Card tone="light">
            <p className="text-sm text-ink">아직 주문 내역이 없습니다.</p>
            <p className="mt-1.5 text-sm text-muted">
              로그인 전에 비회원으로 주문하셨다면{" "}
              <Link
                href="/order/lookup"
                className="font-medium text-brand hover:text-brand-dark"
              >
                주문조회
              </Link>
              에서 주문번호와 연락처로 확인하실 수 있습니다.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {orders.map((order) => (
              <li key={order.id}>
                <MyOrderCard order={order} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** 로그인 전/세션 없음 화면 — 키가 있으면 카카오 버튼, 없으면 안전모드 안내 */
function LoggedOut({ configured }: { configured: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <SectionTitle
        as="h1"
        sub={
          configured
            ? "카카오 계정으로 로그인하면 주문 내역을 한곳에서 확인하실 수 있습니다."
            : "비회원으로도 주문과 주문조회가 가능합니다."
        }
      >
        마이페이지
      </SectionTitle>

      <Card>
        {configured ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              로그인 후 주문 내역과 배송 현황을 확인하실 수 있습니다.
            </p>
            <KakaoLoginButton returnTo="/my" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              현재 로그인 기능은 준비 중입니다. 주문 내역은 주문번호와 연락처로
              주문조회에서 확인하실 수 있습니다.
            </p>
            <Link
              href="/order/lookup"
              className={buttonClasses("primary", "md")}
            >
              주문조회로 이동
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * 마이페이지 주문 카드 — 주문번호·날짜·상품요약·상태(타임라인)·금액·(선물이면 배송건 수)·운송장.
 * 본인 userId 주문만 넘어오므로 재인증 없이 표시한다(로그인으로 인증됨).
 */
function MyOrderCard({ order }: { order: Order }) {
  const showTimeline =
    order.status === "PAID" ||
    order.status === "SHIPPING" ||
    order.status === "DONE";
  const showTracking = order.status === "SHIPPING" || order.status === "DONE";
  const isGift = order.kind === "GIFT" && order.shipments.length > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight tabular-nums text-ink">
            {order.orderNo}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-ink">{itemsSummary(order)}</p>
        <p className="text-lg font-bold tabular-nums text-ink">
          {formatWon(order.totalAmount)}
        </p>
      </div>
      {isGift && (
        <p className="mt-1 text-sm text-muted">
          선물 주문 · 받는 분 {order.shipments.length}곳
        </p>
      )}

      {order.status === "PENDING" && (
        <p className="mt-3 rounded-xl bg-surface px-4 py-3 text-sm font-medium text-ink">
          아직 결제가 완료되지 않은 주문입니다.
        </p>
      )}
      {order.status === "CANCELED" && (
        <p className="mt-3 rounded-xl bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          취소된 주문입니다. 결제하신 금액은 결제수단에 따라 며칠 내로 환불됩니다.
        </p>
      )}

      {showTimeline && (
        <div className="mt-4 border-t border-hairline pt-4">
          <OrderStatusTimeline status={order.status} />
        </div>
      )}

      {showTracking && (
        <div className="mt-4 border-t border-hairline pt-4">
          {isGift ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-ink">배송 정보</p>
              <ul className="flex flex-col gap-2">
                {order.shipments.map((s, i) => (
                  <li
                    key={s.id ?? i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2"
                  >
                    <span className="text-sm font-medium text-ink">
                      {s.recipientName}
                    </span>
                    {s.courier && s.trackingNo ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted">{s.courier}</span>
                        <span className="text-sm font-semibold tabular-nums text-ink">
                          {s.trackingNo}
                        </span>
                        <CopyButton text={s.trackingNo} label="운송장 복사" />
                      </span>
                    ) : (
                      <span className="text-sm text-muted">운송장 준비 중</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">배송 정보</p>
              {order.courier && order.trackingNo ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">{order.courier}</span>
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {order.trackingNo}
                  </span>
                  <CopyButton text={order.trackingNo} label="운송장 복사" />
                </span>
              ) : (
                <span className="text-sm text-muted">운송장 준비 중</span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
