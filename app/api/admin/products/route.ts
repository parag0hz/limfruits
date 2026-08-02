import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { parseProductFields } from "./product-fields";

/**
 * POST /api/admin/products
 * body: { name, subtitle?, detail?, imageUrl?, isActive?, sortOrder? }
 * - name 필수. 생성된 product를 반환한다.
 */
export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

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
  const { fields } = parsed;

  if (fields.name === undefined) {
    return NextResponse.json(
      { error: "상품 이름을 입력해 주세요." },
      { status: 400 }
    );
  }

  const store = getStore();
  const product = await store.createProduct({
    name: fields.name,
    subtitle: fields.subtitle,
    detail: fields.detail,
    imageUrl: fields.imageUrl,
    isActive: fields.isActive,
    sortOrder: fields.sortOrder,
  });

  return NextResponse.json({ ok: true, product });
}
