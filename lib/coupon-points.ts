import type { Coupon } from './types';

/**
 * v2.9 쿠폰·포인트 순수 도메인 로직 — SPEC v2.9 부록.
 *
 * 이 파일은 저장소(store)에 의존하지 않는 순수 계산만 담는다.
 * 할인 금액은 **서버가 이 함수로만 계산**하고, 그 결과를 주문 totalAmount 로 저장한다.
 * (클라이언트가 보낸 할인액·최종금액은 절대 신뢰하지 않는다 — 기존 결제 보안모델 유지)
 */

/** 가입 시 발급하는 첫 구매 쿠폰 규격 (기본값) */
export const SIGNUP_COUPON = {
  name: '첫 구매 할인',
  discountAmount: 3000,
  minOrderAmount: 30000,
  /** 발급 후 유효기간(일) */
  validDays: 90,
} as const;

/** 구매 시 결제액의 1% 적립 */
export const POINT_EARN_RATE = 0.01;

/** 포토리뷰 작성 시 적립 포인트 */
export const REVIEW_POINT = 1000;

/** 적립 포인트 소멸 기간(일) — 1년. (자동 소멸 배치는 Phase 3.1) */
export const POINT_EXPIRY_DAYS = 365;

/**
 * 쿠폰·포인트 차감 후 최소 결제금액(원).
 * 토스 최소 결제금액 및 0원 결제 방지를 위해, 포인트로 이 밑으로는 못 내린다.
 */
export const MIN_PAYABLE_AMOUNT = 1000;

/**
 * PENDING 주문이 이 시간 이상 방치되면 쿠폰·포인트를 반환 가능한 것으로 본다(60분).
 * 결제 승인 유효창(success 페이지 PENDING_CONFIRM_TTL_MS=30분)보다 **크게** 둔다 —
 * 승인 가능한 주문을 stale-release가 취소해 "카드 청구됐는데 주문 취소"가 나는 경계 경합 방지.
 */
export const STALE_PENDING_MS = 60 * 60 * 1000;

/** 결제액에 대한 적립 포인트(원 단위 내림) */
export function earnedPointsFor(paidAmount: number): number {
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) return 0;
  return Math.floor(paidAmount * POINT_EARN_RATE);
}

/** 적립분 소멸 예정일(ISO) — 지금부터 POINT_EXPIRY_DAYS 후 */
export function pointExpiryFrom(nowMs: number): string {
  return new Date(nowMs + POINT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** 쿠폰 만료일(ISO) — 지금부터 SIGNUP_COUPON.validDays 후 */
export function couponExpiryFrom(nowMs: number): string {
  return new Date(
    nowMs + SIGNUP_COUPON.validDays * 24 * 60 * 60 * 1000
  ).toISOString();
}

/**
 * 쿠폰이 이 주문(subtotal)에 **사용 가능한지** 순수 판정.
 * 소유자 확인은 호출부(주문 API)에서 별도로 한다(coupon.userId === session.userId).
 */
export function couponUsable(
  coupon: Coupon | null,
  subtotal: number,
  nowMs: number
): { ok: boolean; reason: string } {
  if (!coupon) return { ok: false, reason: '쿠폰이 없습니다.' };
  if (coupon.status !== 'ISSUED')
    return { ok: false, reason: '이미 사용된 쿠폰입니다.' };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= nowMs)
    return { ok: false, reason: '사용 기간이 지난 쿠폰입니다.' };
  if (subtotal < coupon.minOrderAmount)
    return {
      ok: false,
      reason: `${coupon.minOrderAmount.toLocaleString('ko-KR')}원 이상 주문 시 사용할 수 있어요.`,
    };
  return { ok: true, reason: '' };
}

export interface ResolvedBenefits {
  couponApplied: boolean; // 쿠폰이 실제 적용됐는지
  couponDiscount: number; // 쿠폰 할인액(원)
  pointsUsed: number; // 실제 차감된 포인트(클램프됨)
  finalAmount: number; // 최종 결제금액 = subtotal - couponDiscount - pointsUsed
}

/**
 * 최종 할인·결제금액 계산 (서버 신뢰 소스).
 *
 * - 쿠폰: couponUsable() 통과 시 discountAmount 만큼 차감(단 subtotal 초과 불가).
 * - 포인트: 요청값을 [0, min(잔액, subtotal-couponDiscount-MIN_PAYABLE)] 로 클램프.
 *   → 포인트로 결제금액이 MIN_PAYABLE_AMOUNT 밑으로 내려가지 않는다(0원 결제 방지).
 * - finalAmount 는 항상 정수·MIN_PAYABLE_AMOUNT 이상.
 */
export function resolveBenefits(params: {
  subtotal: number;
  coupon: Coupon | null;
  requestedPoints: number;
  pointsBalance: number;
  nowMs: number;
}): ResolvedBenefits {
  const subtotal = Math.max(0, Math.floor(params.subtotal));

  // 1) 쿠폰
  const usable = couponUsable(params.coupon, subtotal, params.nowMs);
  const couponApplied = usable.ok;
  const couponDiscount =
    couponApplied && params.coupon
      ? Math.min(params.coupon.discountAmount, subtotal)
      : 0;

  // 2) 포인트 — 잔액과 "최소 결제금액 보존" 상한으로 클램프
  const balance = Math.max(0, Math.floor(params.pointsBalance));
  const requested = Math.max(0, Math.floor(params.requestedPoints || 0));
  const maxByFloor = Math.max(0, subtotal - couponDiscount - MIN_PAYABLE_AMOUNT);
  const pointsUsed = Math.min(requested, balance, maxByFloor);

  const finalAmount = subtotal - couponDiscount - pointsUsed;
  return { couponApplied, couponDiscount, pointsUsed, finalAmount };
}

/**
 * PENDING 주문이 방치되어(30분 경과) 쿠폰·포인트를 반환해도 되는지.
 * createdAt 파싱 실패는 오래된 것으로 간주(반환 허용).
 */
export function isStalePending(createdAtIso: string, nowMs: number): boolean {
  const created = new Date(createdAtIso).getTime();
  if (!Number.isFinite(created)) return true;
  return nowMs - created > STALE_PENDING_MS;
}
