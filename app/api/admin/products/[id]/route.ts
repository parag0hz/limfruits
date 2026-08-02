import { NextResponse } from "next/server";
import type { DetailBlock } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { parseProductFields } from "../product-fields";
import { parseDetailBlocks } from "../detail-blocks";

/**
 * PATCH /api/admin/products/[id]
 * body: { name?, subtitle?, detail?, imageUrl?, isActive?, sortOrder?, blocks? } — 부분 수정
 * blocks 는 v2.1 카드뉴스형 상세페이지 블록 배열 전체 교체 (검증: detail-blocks.ts)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const parsed = parseProductFields(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const fields: typeof parsed.fields & { blocks?: DetailBlock[] } = {
    ...parsed.fields,
  };

  // v2.1: 카드뉴스형 상세페이지 블록 — 배열 전체 교체 방식
  if (body.blocks !== undefined) {
    const blocksResult = parseDetailBlocks(body.blocks);
    if (!blocksResult.ok) {
      return NextResponse.json({ error: blocksResult.error }, { status: 400 });
    }
    fields.blocks = blocksResult.blocks;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { error: "변경할 내용이 없습니다." },
      { status: 400 }
    );
  }

  const store = getStore();
  const product = await store.getProduct(id);
  if (!product) {
    return NextResponse.json(
      { error: "상품을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  await store.updateProduct(id, fields);
  const updated = await store.getProduct(id);
  return NextResponse.json({ ok: true, product: updated });
}

/**
 * DELETE /api/admin/products/[id]
 * 상품 + 소속 옵션을 함께 삭제한다 (cascade).
 * 기존 주문은 주문 시점 스냅샷을 저장하므로 영향 없음.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const store = getStore();
  const product = await store.getProduct(id);
  if (!product) {
    return NextResponse.json(
      { error: "상품을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  await store.deleteProduct(id);
  return NextResponse.json({ ok: true });
}
