export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPING' | 'DONE' | 'CANCELED';
// PENDING 결제대기 / PAID 결제완료(신규주문) / SHIPPING 배송중 / DONE 배송완료 / CANCELED 취소

/** v2.1 카드뉴스형 상세페이지 블록 — SPEC v2.1 부록 참고 */
export type DetailBlock =
  | { type: 'heading'; label?: string; title: string }                  // 섹션 라벨(pill) + 큰 제목
  | { type: 'text'; body: string }                                      // 문단 (빈 줄 = 문단 구분)
  | { type: 'image'; url: string; caption?: string }                    // 풀폭 이미지 (긴 상세이미지 재사용 가능)
  | { type: 'point'; title: string; body: string; imageUrl?: string }   // Point N — 렌더 시 자동 번호
  | { type: 'badge'; title: string; body: string; imageUrl?: string }   // 인증·수상 배지
  | { type: 'specs'; title?: string; rows: { k: string; v: string }[] } // 규격/구성 표
  | { type: 'notice'; title: string; body: string };                    // 강조 안내 박스 (포장/예약 등)

export interface Product {
  id: string;              // 'naju-pear' 같은 슬러그 또는 랜덤 id
  name: string;            // 예: "나주배"
  subtitle: string;        // 예: "아삭하고 과즙 가득, 산지에서 바로 보내드려요"
  imageUrl: string | null; // null이면 브랜드 일러스트 placeholder 렌더
  detail: string;          // (구) 단순 본문. blocks 비어 있을 때의 폴백
  blocks: DetailBlock[];   // v2.1: 카드뉴스형 상세페이지 블록 (jsonb, 기본 [])
  isActive: boolean;       // false면 카탈로그/상세 비노출 (admin에서만 보임)
  sortOrder: number;
}

export interface ProductOption {
  id: string;
  productId: string;
  name: string;         // 예: "가정용 3kg" (상품에 소속되므로 상품명 중복 제거)
  description: string;  // 예: "5~7과 · 실속 가정용"
  price: number;        // 원 단위 정수, 배송비 포함가
  soldOut: boolean;
  sortOrder: number;
}

export interface OrderItem {
  productId: string;
  productName: string;  // 주문 시점 스냅샷
  optionId: string;
  optionName: string;   // 주문 시점 스냅샷
  unitPrice: number;
  quantity: number;
}

/** v2.2 구매자 포토 리뷰 — SPEC v2.2 부록 참고 */
export type ReviewStatus = 'VISIBLE' | 'HIDDEN';

export interface Review {
  id: string;            // uuid
  productId: string;
  orderNo: string;       // 주문당 1개 (unique)
  authorName: string;    // 주문자명 원본 저장. 화면 표시는 항상 마스킹(김*원)
  phone: string;         // 숫자만. 검증용 — API 응답·화면에 절대 노출 금지
  rating: number;        // 1~5 정수
  body: string;          // 10~2000자
  photos: string[];      // Storage 공개 URL 최대 3개
  status: ReviewStatus;  // 기본 VISIBLE, 관리자가 숨김 가능
  createdAt: string;
}

/** v2.4 선물·대량 주문 (다중 배송지) — SPEC v2.4 부록 참고 */
export type OrderKind = 'SINGLE' | 'GIFT';

export interface Shipment {
  id: string;             // 배송 건 id (짧은 랜덤)
  recipientName: string;
  phone: string;          // 숫자만 저장
  postcode: string;
  address1: string;
  address2: string;
  giftMessage: string;    // 선물 메시지(선택), 빈 문자열 허용
  items: OrderItem[];     // 이 받는 분에게 가는 구성(옵션·수량 스냅샷)
  courier: string | null; // 배송 건별 운송장
  trackingNo: string | null;
}

/** v2.8 카카오 소셜 로그인 — SPEC v2.8 부록 참고 */
export interface User {
  id: string; // uuid (Supabase gen_random_uuid, 메모리는 randomUUID)
  kakaoId: string; // 카카오 회원번호(문자열). unique
  nickname: string; // 카카오 닉네임. 기본 ''
  points: number; // v2.9 포인트 잔액(현재 사용가능 합계). 기본 0
  createdAt: string; // ISO
}

/** v2.9 쿠폰·포인트 — SPEC v2.9 부록 참고 */
export type CouponStatus = 'ISSUED' | 'USED';

export interface Coupon {
  id: string; // uuid
  userId: string; // 소유 유저
  name: string; // '첫 구매 할인'
  discountAmount: number; // 할인 금액(원)
  minOrderAmount: number; // 최소 주문금액(원) — 이 금액 이상일 때만 사용 가능
  status: CouponStatus; // ISSUED(사용가능) | USED(사용됨·예약됨)
  usedOrderNo: string | null; // 사용/예약된 주문번호
  issuedAt: string; // ISO
  usedAt: string | null; // ISO
  expiresAt: string | null; // ISO — 만료일(지나면 사용 불가)
}

/**
 * 포인트 원장 사유 — 적립(구매/리뷰), 사용, 환불, 취소회수, 소멸.
 * REVOKE = 주문 취소 시 적립 회수(정확한 원장 기준). EXPIRE = 유효기간 만료 소멸(Phase 3.1 배치).
 * 둘을 분리해 (order_no, reason) 멱등 키 충돌을 피한다.
 */
export type PointReason =
  | 'EARN_PURCHASE'
  | 'EARN_REVIEW'
  | 'SPEND'
  | 'REFUND'
  | 'REVOKE'
  | 'EXPIRE';

export interface PointTransaction {
  id: string; // uuid
  userId: string;
  delta: number; // +적립 / -사용·소멸
  reason: PointReason;
  orderNo: string | null; // 관련 주문(있으면)
  createdAt: string; // ISO
  expiresAt: string | null; // 적립분 소멸 예정일(사용/환불/소멸은 null)
}

/** v2.6 입장 팝업 (명절 발송 캘린더) — SPEC v2.6 부록 참고 */
export interface Promo {
  enabled: boolean; // 노출 on/off (기본 false)
  title: string; // "추석 선물세트 예약 안내"
  body: string; // 안내 문구(여러 줄, 빈 줄=문단)
  shipStart: string | null; // 'YYYY-MM-DD' 발송 시작일
  shipEnd: string | null; // 'YYYY-MM-DD' 발송 마감일
  reserveDeadline: string | null; // 'YYYY-MM-DD' 예약 마감일(선택)
  ctaLabel: string; // "선물 주문하기"
  ctaHref: string; // "/order/gift" (내부 경로 '/' 시작만)
}

export interface Order {
  id: string;
  orderNo: string;      // "LF-YYYYMMDD-XXXXXXXX" (대문자 영숫자 8자리 랜덤)
  status: OrderStatus;
  kind: OrderKind;      // v2.4 — 기본 'SINGLE'. GIFT면 top-level 이름/연락처=보내는 분, 주소는 빈 문자열
  customerName: string; // SINGLE=받는 분 / GIFT=보내는 분(주문자)
  phone: string;        // 숫자만 저장 (01012345678). GIFT=보내는 분 연락처
  postcode: string;
  address1: string;
  address2: string;
  memo: string;
  items: OrderItem[];   // GIFT는 모든 배송 건 items를 평탄화한 합 (총액·하위호환용)
  shipments: Shipment[];// v2.4 — GIFT 주문의 받는 분별 배송 건. SINGLE은 []
  userId: string | null; // v2.8 — 로그인(카카오) 주문이면 User.id, 비회원·기존 주문은 null
  totalAmount: number; // 최종 결제금액 = 상품합계 - couponDiscount - pointsUsed. 토스 승인금액과 일치
  couponId: string | null; // v2.9 — 사용한 쿠폰 id (없으면 null)
  couponDiscount: number; // v2.9 — 쿠폰 할인액(원). 기본 0
  pointsUsed: number; // v2.9 — 사용한 포인트(원). 기본 0
  pointsEarned: number; // v2.9 — 이 주문으로 적립 예정/적립된 포인트. 결제완료(markPaid) 시 지급. 기본 0
  marketingConsent: boolean; // v2.7 — 광고성 정보(문자) 수신 동의 (기본 false). GIFT는 보내는 분 동의
  paymentKey: string | null;
  paymentMethod: string | null; // 토스 응답 method (카드/간편결제 등)
  paidAt: string | null;        // ISO
  courier: string | null;       // 택배사명 (SINGLE 주문용. GIFT는 shipments 안에)
  trackingNo: string | null;
  createdAt: string;            // ISO
}
