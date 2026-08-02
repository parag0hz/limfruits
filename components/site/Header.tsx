import Image from "next/image";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/order", label: "주문하기", highlight: true },
  { href: "/order/lookup", label: "주문조회" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-brand shadow-[0_2px_0_rgba(47,89,40,0.6)]">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
        <Link
          href="/"
          aria-label="임과일 홈으로 이동"
          className="flex shrink-0 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-yellow"
        >
          <Image
            src="/logo-long.png"
            alt="임과일"
            width={510}
            height={139}
            priority
            className="h-9 w-auto sm:h-11"
          />
        </Link>

        <nav aria-label="주요 메뉴">
          <ul className="flex items-center gap-0.5 sm:gap-1.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    item.highlight
                      ? "inline-flex min-h-9 items-center rounded-xl border-2 border-brand-dark bg-accent-yellow px-2.5 py-1.5 text-sm font-bold whitespace-nowrap text-ink transition-colors hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-yellow sm:px-4 sm:text-base"
                      : "inline-flex min-h-9 items-center rounded-xl px-2 py-1.5 text-sm font-bold whitespace-nowrap text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-yellow sm:px-3.5 sm:text-base"
                  }
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
