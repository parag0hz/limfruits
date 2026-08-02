import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { MAX_OPTION_PRICE, MAX_SORT_ORDER } from "./option-limits";

/**
 * POST /api/admin/options
 * body: { productId, name, description?, price, soldOut?, sortOrder? }
 * - productId 는 실제 존재하는 상품이어야 한다
 * - price 는 양의 정수(원 단위)만 허용, 상한 있음 (option-limits.ts)
 */
export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: {
    productId?: unknown;
    name?: unknown;
    description?: unknown;
    price?: unknown;
    soldOut?: unknown;
    sortOrder?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (typeof body.productId !== "string" || body.productId.trim() === "") {
    return NextResponse.json(
      { error: "어느 상품의 옵션인지 알 수 없습니다." },
      { status: 400 }
    );
  }

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json(
      { error: "옵션 이름을 입력해 주세요." },
      { status: 400 }
    );
  }

  if (
    typeof body.price !== "number" ||
    !Number.isInteger(body.price) ||
    body.price <= 0
  ) {
    return NextResponse.json(
      { error: "가격은 1원 이상의 정수만 입력할 수 있습니다." },
      { status: 400 }
    );
  }

  if (body.price > MAX_OPTION_PRICE) {
    return NextResponse.json(
      { error: "가격은 1억 원 이하로만 입력할 수 있습니다." },
      { status: 400 }
    );
  }

  if (body.description !== undefined && typeof body.description !== "string") {
    return NextResponse.json(
      { error: "옵션 설명이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (body.soldOut !== undefined && typeof body.soldOut !== "boolean") {
    return NextResponse.json(
      { error: "품절 여부 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (
    body.sortOrder !== undefined &&
    (typeof body.sortOrder !== "number" ||
      !Number.isInteger(body.sortOrder) ||
      body.sortOrder < 0 ||
      body.sortOrder > MAX_SORT_ORDER)
  ) {
    return NextResponse.json(
      { error: "정렬 순서 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const store = getStore();
  const product = await store.getProduct(body.productId);
  if (!product) {
    return NextResponse.json(
      { error: "상품을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const option = await store.createOption({
    productId: body.productId,
    name: body.name.trim(),
    description: body.description?.trim(),
    price: body.price,
    soldOut: body.soldOut,
    sortOrder: body.sortOrder,
  });

  return NextResponse.json({ ok: true, option });
}
