import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/db";
import type { Review } from "@/lib/types";
import { getUserSession, kakaoConfigured } from "@/lib/user-auth";
import ProductGrid, { type CatalogItem } from "@/components/home/ProductGrid";
import SignupCouponBanner from "@/components/promo/SignupCouponBanner";
import { buttonClasses } from "@/components/ui/Button";
import JsonLd from "@/components/seo/JsonLd";
import { organizationSchema, webSiteSchema } from "@/components/seo/schema";

/** 관리자가 상품/가격/품절을 바꾸면 홈에 즉시 반영되도록 항상 동적 렌더 */
export const dynamic = "force-dynamic";

const HOME_TITLE = "임과일 — 나주 산지 직송 배 · 황금배 · 도라지배즙";
const HOME_DESCRIPTION =
  "전남 나주 풍천대봉감농원에서 직접 재배한 나주배·황금배와 도라지배즙을 산지에서 바로 보내드립니다. 표시 가격은 배송비 포함, 주문 확인 후 신선하게 발송합니다.";

export const metadata: Metadata = {
  // 루트 template("%s | 임과일")을 우회해 홈은 완결된 제목을 그대로 쓴다.
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
    siteName: "임과일",
    images: ["/logo.jpeg"],
    locale: "ko_KR",
    type: "website",
  },
};

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
          href="tel:010-2618-5151"
          className="font-medium text-ink underline underline-offset-2"
        >
          010-2618-5151
        </a>
        <br />
        주문·배송 관련 문의를 받습니다.
      </>
    ),
  },
];

export default async function HomePage() {
  const store = getStore();
  // VISIBLE 리뷰 전체를 한 번 조회해 상품별 개수·평균으로 집계한다.
  // (store 인터페이스는 그대로 — 페이지 레벨에서만 집계) 리뷰 조회 실패가
  // 홈 전체를 죽이면 안 되므로 실패 시 빈 배열로 강등한다.
  const [products, options, reviews] = await Promise.all([
    store.listProducts(),
    store.listOptions(),
    store.listReviews({}).catch((e) => {
      console.error("[home] 리뷰 집계 조회 실패 — 별점 없이 렌더합니다:", e);
      return [] as Review[];
    }),
  ]);

  const reviewStats = new Map<string, { sum: number; count: number }>();
  for (const review of reviews) {
    const stat = reviewStats.get(review.productId) ?? { sum: 0, count: 0 };
    stat.sum += review.rating;
    stat.count += 1;
    reviewStats.set(review.productId, stat);
  }

  const items: CatalogItem[] = products.map((product) => {
    const productOptions = options.filter((o) => o.productId === product.id);
    const prices = productOptions.map((o) => o.price);
    const stat = reviewStats.get(product.id);
    const reviewCount = stat?.count ?? 0;
    return {
      product,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      soldOut:
        productOptions.length > 0 && productOptions.every((o) => o.soldOut),
      reviewCount,
      // 원 평균(반올림 전) — Stars 가 한 번만 반올림하도록 두어
      // 상품 상세 상단 요약·하단 후기 섹션과 카드의 별 개수가 일치하게 한다.
      reviewAverage: reviewCount > 0 ? stat!.sum / reviewCount : 0,
    };
  });

  // v2.9 — 가입 쿠폰 배너: 카카오 로그인이 켜져 있고 비회원일 때만 노출.
  // 세션 조회 실패는 배너를 숨기는 쪽으로 강등(홈 렌더에 영향 없음).
  let showSignupBanner = false;
  if (kakaoConfigured()) {
    try {
      showSignupBanner = !(await getUserSession());
    } catch {
      showSignupBanner = false;
    }
  }

  return (
    <div className="flex flex-col">
      {/* 구조화 데이터 — 판매 주체(Organization)와 사이트(WebSite). 홈에 1회 노출 */}
      <JsonLd data={[organizationSchema(), webSiteSchema()]} />

      {/* 가입 쿠폰 안내 배너 (비회원) */}
      {showSignupBanner && <SignupCouponBanner />}

      {/* 히어로 — 짧고 단정하게, 장식 없이. 상단 여백은 상품이 첫 화면에 걸리도록 절제 */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-10 pb-10 text-center sm:px-6 sm:pt-14 sm:pb-14">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-ink sm:text-5xl md:text-6xl">
          나주에서 수확한 그대로.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted sm:text-lg">
          농장에서 직접 재배하고, 주문 확인 후 산지에서 발송합니다.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#products"
            className={buttonClasses("primary", "lg", "w-full sm:w-auto")}
          >
            상품 보기
          </a>
          <Link
            href="/order/gift"
            className={buttonClasses("outline", "lg", "w-full sm:w-auto")}
          >
            선물·대량 주문
          </Link>
        </div>
      </section>

      {/* 상품 카탈로그 — 히어로 "상품 보기" CTA 의 앵커 대상. 헤더가 sticky 라 scroll-mt 로 여백 확보 */}
      <section
        id="products"
        aria-label="판매 상품"
        className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 pb-16 sm:px-6"
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
