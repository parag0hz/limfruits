import Link from "next/link";
import type { ProductOption } from "@/lib/types";
import { formatWon } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import SectionTitle from "@/components/ui/SectionTitle";

function OptionCard({ option }: { option: ProductOption }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-xl text-ink">{option.name}</h3>
        {option.soldOut && <Badge tone="red">품절</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink/70">{option.description}</p>

      <p
        className={`mt-4 text-2xl font-bold sm:text-[1.7rem] ${
          option.soldOut ? "text-ink/40" : "text-brand-dark"
        }`}
      >
        {formatWon(option.price)}
      </p>
      <p className="text-xs text-ink/50">배송비 포함</p>
    </>
  );

  if (option.soldOut) {
    return (
      <div className="flex h-full flex-col rounded-3xl border-2 border-ink/25 bg-white p-5">
        {body}
        <div className="flex-1" />
        <button
          type="button"
          disabled
          className="mt-4 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-2xl border-2 border-ink/20 bg-ink/5 font-bold text-ink/40"
        >
          품절되었어요
        </button>
      </div>
    );
  }

  return (
    <Link
      href={`/order?option=${encodeURIComponent(option.id)}`}
      className="group flex h-full flex-col rounded-3xl border-2 border-brand bg-white p-5 transition-colors hover:bg-brand-light/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {body}
      <div className="flex-1" />
      <span className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border-2 border-brand-dark bg-brand font-bold text-white transition-colors group-hover:bg-brand-dark">
        주문하기
      </span>
    </Link>
  );
}

/**
 * 상품 옵션 카드 그리드 — getStore().listOptions() 결과를 받아 렌더.
 * 품절 옵션은 뱃지 + 버튼 비활성, 판매 중이면 카드 전체가 /order?option=<id> 링크.
 */
export default function ProductGrid({ options }: { options: ProductOption[] }) {
  return (
    <section id="products" className="bg-brand-light">
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
        <SectionTitle
          align="center"
          sub="원하시는 구성을 고르시면 주문 페이지로 이동해요"
        >
          나주배 주문하기
        </SectionTitle>

        {options.length === 0 ? (
          <p className="mt-8 rounded-2xl border-2 border-brand bg-white p-6 text-center text-ink/70">
            지금은 판매 중인 상품이 없어요. 조금만 기다려 주세요.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {options.map((option) => (
              <li key={option.id}>
                <OptionCard option={option} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export { ProductGrid };
