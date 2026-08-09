import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { deleteReviewPhotos } from "@/lib/storage";
import type { Review, ReviewStatus } from "@/lib/types";

/**
 * Store 인터페이스에 id 단건 조회가 없어(SPEC v2.2) 전체 목록에서 찾는다.
 * 리뷰는 주문당 최대 1개라 규모가 작아 문제 없다.
 */
async function findReviewById(id: string): Promise<Review | null> {
  const reviews = await getStore().listReviews({ includeHidden: true });
  return reviews.find((r) => r.id === id) ?? null;
}

/**
 * PATCH /api/admin/reviews/[id]
 * body: { status: 'VISIBLE' | 'HIDDEN' } — 노출/숨김 전환만 허용
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (body.status !== "VISIBLE" && body.status !== "HIDDEN") {
    return NextResponse.json(
      { error: "상태 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const status: ReviewStatus = body.status;

  const review = await findReviewById(id);
  if (!review) {
    return NextResponse.json(
      { error: "리뷰를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  await getStore().setReviewStatus(id, status);
  // phone은 절대 응답에 포함하지 않는다
  return NextResponse.json({ ok: true, status });
}

/**
 * DELETE /api/admin/reviews/[id]
 * Storage의 리뷰 사진도 삭제 시도 — 실패해도 행 삭제는 진행한다.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const review = await findReviewById(id);
  if (!review) {
    return NextResponse.json(
      { error: "리뷰를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 사진 삭제는 베스트 에포트 (lib/storage.ts가 내부에서 throw하지 않지만 이중 방어)
  try {
    await deleteReviewPhotos(review.orderNo);
  } catch {
    // 무시 — 행 삭제는 계속 진행
  }

  await getStore().deleteReview(id);
  return NextResponse.json({ ok: true });
}
