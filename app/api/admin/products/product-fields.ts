/**
 * POST/PATCH /api/admin/products 공용 입력 검증.
 * 존재하는 필드만 검사해 담아 반환한다 (부분 수정 지원).
 */

import { isValidBlockImageUrl } from "./detail-blocks";

export type ProductFields = Partial<{
  name: string;
  subtitle: string;
  detail: string;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}>;

export type ParseResult =
  | { ok: true; fields: ProductFields }
  | { ok: false; error: string };

export function parseProductFields(body: Record<string, unknown>): ParseResult {
  const fields: ProductFields = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return { ok: false, error: "상품 이름을 입력해 주세요." };
    }
    fields.name = body.name.trim();
  }

  if (body.subtitle !== undefined) {
    if (typeof body.subtitle !== "string") {
      return { ok: false, error: "한 줄 소개 값이 올바르지 않습니다." };
    }
    fields.subtitle = body.subtitle.trim();
  }

  if (body.detail !== undefined) {
    if (typeof body.detail !== "string") {
      return { ok: false, error: "상세 소개 값이 올바르지 않습니다." };
    }
    fields.detail = body.detail.trim();
  }

  if (body.imageUrl !== undefined) {
    if (body.imageUrl === null) {
      fields.imageUrl = null;
    } else if (typeof body.imageUrl !== "string") {
      return { ok: false, error: "사진 주소 값이 올바르지 않습니다." };
    } else {
      const trimmed = body.imageUrl.trim();
      if (trimmed === "") {
        fields.imageUrl = null;
      } else if (!isValidBlockImageUrl(trimmed)) {
        // 상세페이지 블록 사진과 같은 규칙(https:// 또는 / 시작).
        // javascript: 등 위험한 스킴이 <img src>로 흘러가는 것도 함께 방지
        return {
          ok: false,
          error: "사진 주소는 https:// 로 시작하는 인터넷 주소여야 합니다.",
        };
      } else {
        fields.imageUrl = trimmed;
      }
    }
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return { ok: false, error: "노출 여부 값이 올바르지 않습니다." };
    }
    fields.isActive = body.isActive;
  }

  if (body.sortOrder !== undefined) {
    if (
      typeof body.sortOrder !== "number" ||
      !Number.isInteger(body.sortOrder) ||
      body.sortOrder < 0 ||
      // Supabase sort_order 컬럼(int4) 범위 초과로 500이 나지 않도록 상한 제한
      body.sortOrder > 1_000_000
    ) {
      return { ok: false, error: "정렬 순서 값이 올바르지 않습니다." };
    }
    fields.sortOrder = body.sortOrder;
  }

  return { ok: true, fields };
}
