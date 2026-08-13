import { buttonClasses } from "@/components/ui/Button";

/**
 * 로그아웃 버튼 — `POST /api/auth/logout`으로 네이티브 폼 전송.
 * JS 없이 동작하며, 라우트가 세션 쿠키를 지우고 '/'로 리다이렉트한다.
 */
export default function LogoutButton({
  className,
}: {
  className?: string;
}) {
  return (
    <form action="/api/auth/logout" method="post" className={className}>
      <button type="submit" className={buttonClasses("outline", "md")}>
        로그아웃
      </button>
    </form>
  );
}

export { LogoutButton };
