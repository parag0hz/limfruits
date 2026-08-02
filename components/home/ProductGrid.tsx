import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatWon } from "@/lib/format";
import Badge from "@/components/ui/Badge";

export interface CatalogItem {
  product: Product;
  /** 옵션 최저가. 옵션이 없으면 null */
  minPrice: number | null;
  /** 전 옵션 품절 (옵션이 하나라도 있고 모두 soldOut) */
  soldOut: boolean;
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
  const { product, minPrice, soldOut } = item;
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
    <ul className="mx-auto grid w-full max-w-4xl grid-cols-[repeat(auto-fit,minmax(15rem,19rem))] justify-center gap-5">
      {items.map((item) => (
        <li key={item.product.id}>
          <ProductCard item={item} />
        </li>
      ))}
    </ul>
  );
}

export { ProductGrid };
