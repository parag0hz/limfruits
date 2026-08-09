import type { Metadata } from "next";
import { getStore } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import ReviewCard from "./ReviewCard";

export const metadata: Metadata = {
  title: "리뷰 관리",
};

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const store = getStore();
  const reviews = await store.listReviews({ includeHidden: true });

  // 상품명 조회 — 삭제된 상품이면 "삭제된 상품"으로 표시
  const productIds = [...new Set(reviews.map((r) => r.productId))];
  const products = await Promise.all(
    productIds.map((id) => store.getProduct(id))
  );
  const productNameById = new Map<string, string>();
  productIds.forEach((id, i) => {
    const product = products[i];
    if (product) productNameById.set(id, product.name);
  });

  const hiddenCount = reviews.filter((r) => r.status === "HIDDEN").length;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-ink">리뷰 관리</h1>
      <p className="mt-1 text-base text-muted">
        손님이 남긴 구매 후기입니다. 부적절한 후기는 숨기거나 삭제할 수
        있습니다.
      </p>

      {reviews.length > 0 && (
        <p className="mt-3 text-base font-semibold text-muted">
          전체 {reviews.length}개
          {hiddenCount > 0 && ` · 숨김 ${hiddenCount}개`}
        </p>
      )}

      {reviews.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-surface px-5 py-12 text-center">
          <p className="text-xl font-bold text-ink">
            아직 등록된 리뷰가 없습니다.
          </p>
          <p className="mt-2 text-base text-muted">
            손님이 후기를 남기면 이 화면에 표시됩니다.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard
                id={review.id}
                orderNo={review.orderNo}
                productName={
                  productNameById.get(review.productId) ?? "삭제된 상품"
                }
                authorName={review.authorName}
                rating={review.rating}
                body={review.body}
                photos={review.photos}
                initialStatus={review.status}
                createdAtText={formatDateTime(review.createdAt)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
