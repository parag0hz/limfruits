/**
 * 옵션 입력값 상한 (POST /api/admin/options, PATCH /api/admin/options/[id] 공용).
 * Supabase의 price/sort_order 컬럼이 int4라, 상한 없이 통과시키면
 * 'value out of range for type integer'로 500이 난다. 검증 단계에서 400으로 막는다.
 */

/** 가격 상한: 1억 원. 최대 수량 20개를 곱해도 int4 범위(약 21억) 안이다. */
export const MAX_OPTION_PRICE = 100_000_000;

/** 정렬 순서 상한 — 직접 입력할 일이 없는 값이라 넉넉하게만 제한 */
export const MAX_SORT_ORDER = 1_000_000;
