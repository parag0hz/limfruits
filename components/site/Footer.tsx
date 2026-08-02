import Link from "next/link";

/** BRAND v2 푸터 — 서피스 배경 + 헤어라인, 사업자 정보 placeholder (PLACEHOLDERS.md 참고) */
export default function Footer() {
  return (
    <footer className="mt-16 border-t border-hairline bg-surface">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-base font-bold tracking-tight text-ink">임과일</p>
        <p className="mt-1 text-sm text-muted">
          농장에서 직접 재배하고, 주문 확인 후 산지에서 발송합니다.
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm text-muted sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium">상호</dt>
            <dd>OOO농원 (대표 OOO)</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium">사업자등록번호</dt>
            <dd>OOO-OO-OOOOO</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium">통신판매업신고</dt>
            <dd>제OOOO-전남나주-OOOO호</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium">고객센터</dt>
            <dd>
              <a
                href="tel:010-0000-0000"
                className="underline underline-offset-2 hover:text-ink"
              >
                010-OOOO-OOOO
              </a>
            </dd>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 font-medium">농장주소</dt>
            <dd>전라남도 나주시 OOO읍 OOO길 OO</dd>
          </div>
        </dl>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-hairline pt-4 text-xs text-muted">
          <p>© {new Date().getFullYear()} 임과일 limfruits</p>
          {/* 판매자가 폰으로 /admin 진입하는 링크 — 시각 크기는 유지하고 터치 타깃만 44px+로 확대 */}
          <Link
            href="/admin"
            className="-my-3 -mr-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            관리자
          </Link>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
