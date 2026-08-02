import { getStore } from "@/lib/db";
import ProductGrid, { type CatalogItem } from "@/components/home/ProductGrid";

/** 관리자가 상품/가격/품절을 바꾸면 홈에 즉시 반영되도록 항상 동적 렌더 */
export const dynamic = "force-dynamic";

const FACTS: { title: string; body: React.ReactNode }[] = [
  {
    title: "산지 직송",
    body: "전남 나주 과수원에서 직접 재배합니다. 주문 확인 후 선별해 산지에서 바로 발송합니다.",
  },
  {
    title: "배송 안내",
    body: "발송 후 보통 1~2일 안에 도착합니다. 표시된 가격에 배송비가 포함되어 있습니다.",
  },
  {
    title: "문의",
    body: (
      <>
        전화{" "}
        <a
          href="tel:010-0000-0000"
          className="font-medium text-ink underline underline-offset-2"
        >
          010-OOOO-OOOO
        </a>
        <br />
        주문·배송 관련 문의를 받습니다.
      </>
    ),
  },
];

export default async function HomePage() {
  const store = getStore();
  const [products, options] = await Promise.all([
    store.listProducts(),
    store.listOptions(),
  ]);

  const items: CatalogItem[] = products.map((product) => {
    const productOptions = options.filter((o) => o.productId === product.id);
    const prices = productOptions.map((o) => o.price);
    return {
      product,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      soldOut:
        productOptions.length > 0 && productOptions.every((o) => o.soldOut),
    };
  });

  return (
    <div className="flex flex-col">
      {/* 히어로 — 짧고 단정하게, 장식 없이 */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-16">
        <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl md:text-6xl">
          나주에서 수확한 그대로.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">
          농장에서 직접 재배하고, 주문 확인 후 산지에서 발송합니다.
        </p>
      </section>

      {/* 상품 카탈로그 */}
      <section
        id="products"
        aria-label="판매 상품"
        className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6"
      >
        <ProductGrid items={items} />
      </section>

      {/* 구매 안내 — 간결한 3열 팩트 */}
      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6 sm:py-16">
          {FACTS.map((fact) => (
            <div key={fact.title}>
              <h2 className="text-sm font-semibold text-ink">{fact.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {fact.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
