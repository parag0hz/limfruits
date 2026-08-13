import type { Metadata } from "next";
import { getStore } from "@/lib/db";
import { formatWon, formatDateTime } from "@/lib/format";
import type { PointTransaction } from "@/lib/types";

export const metadata: Metadata = {
  title: "회원",
};

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<PointTransaction["reason"], string> = {
  EARN_PURCHASE: "구매 적립",
  EARN_REVIEW: "리뷰 적립",
  SPEND: "주문 사용",
  REFUND: "취소 환불",
  REVOKE: "취소 회수",
  EXPIRE: "기간 만료",
};

/**
 * v3.1 — 관리자 회원(쿠폰·포인트) 조회. 회원별 잔액·쿠폰·최근 포인트 내역.
 * 저볼륨 가정(회원당 쿠폰·내역을 개별 조회) — 회원이 많아지면 페이지네이션 필요.
 */
export default async function AdminMembersPage() {
  const store = getStore();
  const users = await store.listUsers();
  const now = Date.now();

  const rows = await Promise.all(
    users.map(async (user) => ({
      user,
      coupons: await store.listCouponsByUser(user.id),
      tx: await store.listPointTransactions(user.id, 5),
    }))
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">회원</h1>
        <p className="text-base text-muted">{users.length}명</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-white p-6 text-center text-lg text-muted">
          아직 가입한 회원이 없습니다.
        </p>
      ) : (
        rows.map(({ user, coupons, tx }) => {
          const usable = coupons.filter(
            (c) =>
              c.status === "ISSUED" &&
              (!c.expiresAt || new Date(c.expiresAt).getTime() > now)
          );
          return (
            <div
              key={user.id}
              className="rounded-2xl border border-hairline bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xl font-bold text-ink">
                    {user.nickname || "회원"}
                  </p>
                  <p className="text-sm text-muted">
                    가입 {formatDateTime(user.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-muted">보유 포인트</p>
                  <p className="text-2xl font-bold tabular-nums text-ink">
                    {Math.max(0, user.points).toLocaleString("ko-KR")}
                    <span className="ml-0.5 text-base font-normal text-muted">
                      P
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-hairline pt-3">
                <p className="text-sm font-semibold text-ink">
                  쿠폰 {usable.length}장 사용 가능
                </p>
                {coupons.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {coupons.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-ink">
                          {c.name}{" "}
                          <span className="text-muted">
                            ({formatWon(c.discountAmount)})
                          </span>
                        </span>
                        <span
                          className={
                            c.status === "ISSUED"
                              ? "font-medium text-brand"
                              : "text-muted"
                          }
                        >
                          {c.status === "ISSUED" ? "사용가능" : "사용됨"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {tx.length > 0 && (
                <div className="mt-3 border-t border-hairline pt-3">
                  <p className="text-sm font-semibold text-ink">최근 포인트</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {tx.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-muted">
                          {REASON_LABEL[t.reason]} · {formatDateTime(t.createdAt)}
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            t.delta >= 0 ? "text-brand" : "text-ink"
                          }`}
                        >
                          {t.delta >= 0 ? "+" : ""}
                          {t.delta.toLocaleString("ko-KR")}P
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
