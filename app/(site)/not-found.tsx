import Link from 'next/link';

/** (site) 라우트의 notFound() 경계 — 비활성/없는 상품 등 */
export default function SiteNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-3 text-base text-muted">
          주소가 잘못되었거나, 판매가 종료된 상품일 수 있습니다.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        홈으로 가기
      </Link>
    </div>
  );
}
