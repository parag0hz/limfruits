import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import type { ProductOption } from "@/lib/types";

/**
 * PATCH /api/admin/options/[id]
 * body: { name?, description?, price?, soldOut?, sortOrder? }
 * - price는 양의 정수(원 단위)만 허용
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  let body: {
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

  const patch: Partial<Omit<ProductOption, "id">> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json(
        { error: "옵션 이름을 입력해 주세요." },
        { status: 400 }
      );
    }
    patch.name = body.name.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      return NextResponse.json(
        { error: "옵션 설명이 올바르지 않습니다." },
        { status: 400 }
      );
    }
    patch.description = body.description.trim();
  }

  if (body.price !== undefined) {
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
    patch.price = body.price;
  }

  if (body.soldOut !== undefined) {
    if (typeof body.soldOut !== "boolean") {
      return NextResponse.json(
        { error: "품절 여부 값이 올바르지 않습니다." },
        { status: 400 }
      );
    }
    patch.soldOut = body.soldOut;
  }

  if (body.sortOrder !== undefined) {
    if (
      typeof body.sortOrder !== "number" ||
      !Number.isInteger(body.sortOrder) ||
      body.sortOrder < 0
    ) {
      return NextResponse.json(
        { error: "정렬 순서 값이 올바르지 않습니다." },
        { status: 400 }
      );
    }
    patch.sortOrder = body.sortOrder;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "변경할 내용이 없습니다." },
      { status: 400 }
    );
  }

  const store = getStore();
  const option = await store.getOption(id);
  if (!option) {
    return NextResponse.json(
      { error: "옵션을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  await store.updateOption(id, patch);
  const updated = await store.getOption(id);
  return NextResponse.json({ ok: true, option: updated });
}
