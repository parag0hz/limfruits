import { cn } from "@/components/ui/cn";

/**
 * 카카오 로그인 진입 버튼 — `/api/auth/kakao`(카카오 authorize)로 이동한다.
 * API 라우트라 next/link 대신 순수 <a>를 써서 클라이언트 프리페치를 피한다
 * (프리페치가 OAuth state 쿠키/리다이렉트를 미리 트리거하지 않도록).
 *
 * 색은 카카오 로그인 표준 버튼(#FEE500) — 결제 제공자(토스)처럼 인증 제공자
 * 브랜드 요소에 한해 허용하는 예외이며, 나머지 화면은 BRAND v2를 따른다.
 */
export default function KakaoLoginButton({
  returnTo,
  className,
}: {
  /** 로그인 성공 후 돌아갈 내부 경로('/' 시작만). 서버에서 재검증됨 */
  returnTo?: string;
  className?: string;
}) {
  const href = returnTo
    ? `/api/auth/kakao?return_to=${encodeURIComponent(returnTo)}`
    : "/api/auth/kakao";

  return (
    <a
      href={href}
      className={cn(
        "inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        className
      )}
      style={{ backgroundColor: "#FEE500", color: "rgba(0, 0, 0, 0.85)" }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="currentColor"
      >
        <path d="M12 3.5C6.9 3.5 2.75 6.74 2.75 10.73c0 2.5 1.63 4.7 4.11 6-.18.64-.66 2.4-.75 2.77-.12.46.17.46.36.33.15-.1 2.35-1.6 3.31-2.25.72.1 1.46.16 2.22.16 5.1 0 9.25-3.24 9.25-7.23S17.1 3.5 12 3.5z" />
      </svg>
      카카오 로그인
    </a>
  );
}

export { KakaoLoginButton };
