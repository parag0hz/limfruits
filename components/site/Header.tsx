import Image from "next/image";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/order/lookup", label: "주문조회" },
];

/** BRAND v2 헤더 — 화이트 + backdrop-blur 스티키, 하단 헤어라인, 로고 칩 + 워드마크 */
export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          aria-label="임과일 홈으로 이동"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Image
            src="/logo.jpeg"
            alt=""
            width={667}
            height={667}
            priority
            className="h-7 w-7 rounded-lg object-cover"
          />
          <span className="text-lg font-bold tracking-tight text-ink">
            임과일
          </span>
        </Link>

        <nav aria-label="주요 메뉴">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-ink transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-base"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export { Header };
