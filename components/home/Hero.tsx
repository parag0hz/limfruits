import Image from "next/image";
import Link from "next/link";

/**
 * 홈 히어로 — 그린 배경 위에 로고의 흰 아치(무지개) 모티프를 CSS로 재현.
 * 아치 아래에 로고 일러스트, 헤드라인, CTA 2개(주문하기 / 주문조회).
 */
export default function Hero() {
  return (
    <section className="bg-brand text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-10 pb-14 text-center sm:px-6 sm:pt-14 sm:pb-16">
        {/* 흰 아치(무지개) 모티프 + 로고 일러스트 */}
        <div className="relative flex h-48 w-64 items-end justify-center sm:h-56 sm:w-80">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 bottom-0 rounded-t-full border-[6px] border-b-0 border-white/90"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-6 bottom-0 rounded-t-full border-[6px] border-b-0 border-white/60 sm:inset-x-8 sm:top-8"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-12 top-12 bottom-0 rounded-t-full border-[6px] border-b-0 border-white/30 sm:inset-x-16 sm:top-16"
          />
          <Image
            src="/logo.jpeg"
            alt="임과일 로고 — 배를 든 농부 일러스트"
            width={667}
            height={667}
            priority
            className="relative h-32 w-32 rounded-full border-4 border-white object-cover sm:h-36 sm:w-36"
          />
        </div>

        <h1 className="mt-8 font-heading text-3xl leading-snug sm:text-4xl md:text-5xl md:leading-snug">
          가족이 직접 농사지은 나주배를
          <br />
          산지에서 바로 보내드립니다
        </h1>
        <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">
          전남 나주의 과수원에서 정성껏 키운 배를
          <br className="sm:hidden" /> 수확한 그대로 포장해 문 앞까지 보내드려요.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link
            href="/order"
            className="inline-flex min-h-13 items-center justify-center rounded-2xl border-2 border-brand-dark bg-accent-yellow px-8 py-3 text-lg font-bold text-ink transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-yellow"
          >
            주문하기
          </Link>
          <Link
            href="/order/lookup"
            className="inline-flex min-h-13 items-center justify-center rounded-2xl border-2 border-white px-8 py-3 text-lg font-bold text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-yellow"
          >
            주문조회
          </Link>
        </div>
      </div>

      {/* 크림색 본문으로 이어지는 완만한 아치 곡선 */}
      <div aria-hidden className="h-8 w-full rounded-t-[100%] bg-cream sm:h-12" />
    </section>
  );
}

export { Hero };
