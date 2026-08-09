import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatWon } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import Stars from "@/components/review/Stars";

export interface CatalogItem {
  product: Product;
  /** 옵션 최저가. 옵션이 없으면 null */
  minPrice: number | null;
  /** 전 옵션 품절 (옵션이 하나라도 있고 모두 soldOut) */
  soldOut: boolean;
  /** VISIBLE 리뷰 개수 (0이면 별점 미표시) */
  reviewCount: number;
  /** VISIBLE 리뷰 평균 별점 — 원 평균(반올림 전). Stars 가 한 번만 반올림한다 */
  reviewAverage: number;
}

/** 대표이미지가 없을 때 — 서피스 배경에 로고 일러스트를 작고 정갈하게 */
function ImagePlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface">
      <Image
        src="/logo.jpeg"
        alt=""
        width={667}
        height={667}
        className="h-16 w-16 rounded-2xl object-cover opacity-90"
      />
    </div>
  );
}

function ProductCard({ item }: { item: CatalogItem }) {
  const { product, minPrice, soldOut, reviewCount, reviewAverage } = item;
  return (
    <Link
      href={`/products/${encodeURIComponent(product.id)}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-white transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {product.imageUrl ? (
          // 관리자가 입력하는 외부 URL이라 next/image 원격 도메인 설정 없이 img로 렌더
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <ImagePlaceholder />
        )}
        {soldOut && (
          <Badge tone="red" className="absolute top-3 left-3">
            품절
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold text-ink">{product.name}</h3>
        {product.subtitle && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">
            {product.subtitle}
          </p>
        )}
        {reviewCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <Stars rating={reviewAverage} size="sm" />
            <span className="text-xs text-muted tabular-nums">
              (후기 {reviewCount})
            </span>
          </div>
        )}
        <p className="mt-3 text-lg font-semibold tabular-nums text-ink">
          {minPrice !== null ? (
            <>
              {formatWon(minPrice)}
              <span className="font-medium text-muted">~</span>
            </>
          ) : (
            <span className="text-base font-medium text-muted">준비 중</span>
          )}
        </p>
      </div>
    </Link>
  );
}

/**
 * 홈 상품 카탈로그 그리드 — listProducts() 결과 + 옵션 요약을 받아 렌더.
 * 카드 전체가 /products/[id] 링크.
 * auto-fit + 고정폭 카드 + justify-center 라 상품이 1~2개뿐이어도
 * 남는 열 없이 중앙 정렬된다 (3개 이상이면 최대 3열).
 */
export default function ProductGrid({ items }: { items: CatalogItem[] }) {
  if (items.length === 0) {
    return (
      <p className="mx-auto max-w-md rounded-2xl border border-hairline bg-white p-8 text-center text-muted">
        지금은 판매 중인 상품이 없습니다. 준비되는 대로 다시 안내드리겠습니다.
      </p>
    );
  }

  return (
    <>
      <ul className="mx-auto grid w-full max-w-4xl grid-cols-[repeat(auto-fit,minmax(15rem,19rem))] justify-center gap-5">
        {items.map((item) => (
          <li key={item.product.id}>
            <ProductCard item={item} />
          </li>
        ))}
      </ul>
      {/* 선물·대량 주문 진입 배너 — 작은 텍스트 링크에서 눈에 띄는 배너로 승격 */}
      <div className="mx-auto mt-10 flex w-full max-w-4xl flex-col items-center gap-4 rounded-2xl border border-hairline bg-surface px-6 py-7 text-center sm:flex-row sm:justify-between sm:gap-6 sm:text-left">
        <div>
          <h3 className="text-base font-semibold text-ink">
            여러 곳에 선물 보내기
          </h3>
          <p className="mt-1 text-sm text-muted">
            받는 분이 여러 명이어도 엑셀 양식으로 한 번에 주문하고 결제할 수
            있습니다.
          </p>
        </div>
        <Link
          href="/order/gift"
          className={buttonClasses("primary", "md", "w-full shrink-0 sm:w-auto")}
        >
          선물·대량 주문
        </Link>
      </div>
    </>
  );
}

export { ProductGrid };
