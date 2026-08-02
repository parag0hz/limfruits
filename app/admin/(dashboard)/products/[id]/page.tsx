import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/db";
import ProductForm from "./ProductForm";
import OptionEditor from "./OptionEditor";
import AddOptionForm from "./AddOptionForm";
import DeleteProductButton from "./DeleteProductButton";
import DetailBlocksEditor from "./DetailBlocksEditor";

export const metadata: Metadata = {
  title: "상품 편집",
};

export const dynamic = "force-dynamic";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  // Next가 이미 percent-decode한 값이라 재디코딩 실패 시 원문을 사용 (500 방지)
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    // 원문 그대로 사용
  }

  const store = getStore();
  const product = await store.getProduct(id);

  if (!product) {
    return (
      <div className="py-10 text-center">
        <p className="text-xl font-bold text-ink">상품을 찾을 수 없습니다.</p>
        <Link
          href="/admin/products"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full border border-hairline bg-white px-6 text-lg font-semibold text-ink transition-colors hover:bg-surface"
        >
          상품 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const options = await store.listOptions(product.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/products"
          className="inline-flex min-h-11 items-center gap-1 text-lg font-semibold text-brand-dark hover:underline"
        >
          &lt; 상품 목록
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          {product.name}
        </h1>
        <p className="mt-1 text-base text-muted">
          내용을 고친 뒤 꼭 &lsquo;저장&rsquo;을 눌러 주세요.
        </p>
      </div>

      {/* 상품 정보 폼 (노출 토글 포함) */}
      <ProductForm product={product} />

      {/* 옵션 관리 */}
      <section>
        <h2 className="text-xl font-bold tracking-tight text-ink">판매 옵션</h2>
        <p className="mt-1 text-base text-muted">
          손님이 고르는 무게·구성별 가격입니다. 품절은 누르면 바로 저장됩니다.
        </p>

        {options.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-hairline bg-surface px-5 py-8 text-center">
            <p className="text-lg font-bold text-ink">아직 옵션이 없습니다.</p>
            <p className="mt-1 text-base text-muted">
              옵션이 하나도 없으면 주문을 받을 수 없습니다. 아래에서 추가해
              주세요.
            </p>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {options.map((option) => (
              <li key={option.id}>
                <OptionEditor option={option} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <AddOptionForm productId={product.id} />
        </div>
      </section>

      {/* v2.1 카드뉴스형 상세페이지 블록 편집 */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-ink">
            상세페이지 구성
          </h2>
          {product.isActive ? (
            <a
              href={`/products/${encodeURIComponent(product.id)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline bg-white px-5 text-base font-semibold text-ink transition-colors hover:bg-surface"
            >
              미리보기 (새 창)
            </a>
          ) : (
            // 숨김 상품은 손님 상세 화면이 404라 미리보기를 열 수 없다
            <span
              aria-disabled="true"
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-full border border-hairline bg-surface px-5 text-base font-semibold text-muted"
            >
              미리보기 (새 창)
            </span>
          )}
        </div>
        <p className="mt-1 text-base text-muted">
          손님이 보는 상세 화면을 블록(카드) 단위로 만듭니다. 위에서 아래
          순서대로 보입니다.{" "}
          {product.isActive
            ? "미리보기는 저장한 내용 기준으로 열립니다."
            : "지금은 숨김 상태라 미리보기를 열 수 없습니다. 위 상품 정보에서 '보이게 하기'를 누르면 열 수 있습니다."}
        </p>

        <div className="mt-3">
          <DetailBlocksEditor
            productId={product.id}
            initialBlocks={product.blocks}
          />
        </div>
      </section>

      {/* 상품 삭제 — 맨 아래 */}
      <section className="border-t border-hairline pt-5">
        <DeleteProductButton
          productId={product.id}
          productName={product.name}
        />
      </section>
    </div>
  );
}
