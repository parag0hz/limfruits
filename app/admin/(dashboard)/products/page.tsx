import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/db";
import type { Product, ProductOption } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import { formatWon } from "@/lib/format";
import AddProductButton from "./AddProductButton";

export const metadata: Metadata = {
  title: "상품 관리",
};

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const store = getStore();
  const [products, options] = await Promise.all([
    store.listProducts(true), // 숨김 상품도 관리 화면에는 보여야 함
    store.listOptions(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-ink">상품 관리</h1>
      <p className="mt-1 text-base text-muted">
        상품을 누르면 이름, 사진, 가격을 수정할 수 있습니다.
      </p>

      <div className="mt-4">
        <AddProductButton />
      </div>

      {products.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-surface px-5 py-12 text-center">
          <p className="text-xl font-bold text-ink">
            아직 등록된 상품이 없습니다.
          </p>
          <p className="mt-2 text-base text-muted">
            위의 &lsquo;상품 추가&rsquo; 버튼으로 첫 상품을 등록해 주세요.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                options={options.filter((o) => o.productId === product.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductCard({
  product,
  options,
}: {
  product: Product;
  options: ProductOption[];
}) {
  const minPrice =
    options.length > 0 ? Math.min(...options.map((o) => o.price)) : null;

  return (
    <Link
      href={`/admin/products/${product.id}`}
      className="block rounded-2xl border border-hairline bg-white p-4 transition-colors hover:bg-surface active:bg-surface"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-xl font-bold text-ink">
          {product.name}
        </p>
        <Badge
          tone={product.isActive ? "green" : "gray"}
          className="mt-0.5 shrink-0"
        >
          {product.isActive ? "노출중" : "숨김"}
        </Badge>
      </div>
      {product.subtitle && (
        <p className="mt-1 truncate text-base text-muted">{product.subtitle}</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        {options.length > 0 ? (
          <p className="text-base text-muted">옵션 {options.length}개</p>
        ) : (
          <p className="text-base font-semibold text-danger">
            옵션 없음 · 주문 불가
          </p>
        )}
        <p className="text-xl font-bold text-brand-dark tabular-nums">
          {minPrice !== null ? `${formatWon(minPrice)}~` : "가격 미정"}
        </p>
      </div>
      <p className="mt-1 text-right text-base font-semibold text-brand-dark">
        수정하기 &gt;
      </p>
    </Link>
  );
}
