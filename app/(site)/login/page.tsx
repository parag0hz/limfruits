import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { kakaoConfigured, getUserSession } from "@/lib/user-auth";
import SectionTitle from "@/components/ui/SectionTitle";
import Card from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import KakaoLoginButton from "@/components/auth/KakaoLoginButton";

export const metadata: Metadata = {
  title: "로그인",
  description: "카카오 계정으로 로그인하고 주문 내역을 한곳에서 확인하세요.",
};

/** 내부 경로('/'로 시작, '//' 제외)만 허용 — 오픈 리다이렉트 방지 */
function safeReturnTo(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/my";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    return_to?: string | string[];
  }>;
}) {
  const configured = kakaoConfigured();

  // 이미 로그인 상태면 마이페이지로
  if (configured) {
    const session = await getUserSession();
    if (session) redirect("/my");
  }

  const sp = await searchParams;
  const hasError = typeof sp.error === "string" && sp.error.length > 0;
  const returnTo = safeReturnTo(
    typeof sp.return_to === "string" ? sp.return_to : undefined
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <SectionTitle
        as="h1"
        sub={
          configured
            ? "카카오 계정으로 로그인하면 주문 내역과 배송 현황을 확인하실 수 있습니다."
            : "비회원으로도 주문과 주문조회가 가능합니다."
        }
      >
        로그인
      </SectionTitle>

      <Card>
        {hasError && (
          <p
            className="mb-4 rounded-xl bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
            role="alert"
          >
            로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        )}

        {configured ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              로그인은 주문 내역 확인 편의를 위한 기능입니다. 주문과 결제는
              로그인 없이도 이용하실 수 있습니다.
            </p>
            <KakaoLoginButton returnTo={returnTo} />
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
