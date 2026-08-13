import Link from "next/link";
import { SIGNUP_COUPON } from "@/lib/coupon-points";
import { formatWon } from "@/lib/format";

/**
 * v2.9 — 가입(카카오 로그인) 시 첫 구매 할인 쿠폰 안내 배너.
 * 홈 상단에 비회원에게만 노출한다(로그인하면 사라짐). BRAND v2: 절제된 브랜드 톤 스트립.
 */
export default function SignupCouponBanner() {
  return (
    <div className="border-b border-hairline bg-brand/5">
      <Link
        href="/login"
        className="mx-auto flex w-full max-w-5xl items-center justify-center gap-2 px-4 py-2.5 text-center text-sm text-ink transition-colors hover:bg-brand/10 sm:px-6"
      >
        <span>
          카카오 로그인하고{" "}
          <span className="font-semibold text-brand">
            첫 구매 {formatWon(SIGNUP_COUPON.discountAmount)} 할인 쿠폰
          </span>{" "}
          받기
        </span>
        <span aria-hidden className="font-semibold text-brand">
          →
        </span>
      </Link>
    </div>
  );
}
