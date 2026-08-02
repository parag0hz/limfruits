import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-12 bg-brand text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <p className="font-heading text-2xl">임과일</p>
        <p className="mt-1 text-sm text-white/80">
          가족이 직접 농사지은 나주배를 산지에서 바로 보내드립니다.
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm text-white/90 sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="shrink-0 font-bold text-white/70">상호</dt>
            <dd>OOO농원 (대표 OOO)</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-bold text-white/70">사업자등록번호</dt>
            <dd>OOO-OO-OOOOO</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-bold text-white/70">통신판매업신고</dt>
            <dd>제OOOO-전남나주-OOOO호</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-bold text-white/70">고객센터</dt>
            <dd>
              <a href="tel:010-0000-0000" className="underline underline-offset-2">
                010-OOOO-OOOO
              </a>
            </dd>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 font-bold text-white/70">농장주소</dt>
            <dd>전라남도 나주시 OOO읍 OOO길 OO</dd>
          </div>
        </dl>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/20 pt-4 text-xs text-white/60">
          <p>© {new Date().getFullYear()} 임과일 limfruits. All rights reserved.</p>
          {/* 부모님이 폰으로 /admin 진입하는 링크 — 시각 크기는 유지하고 터치 타깃만 44px+로 확대 */}
          <Link
            href="/admin"
            className="-my-3 -mr-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-yellow"
          >
            관리자
          </Link>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
