import type {
  Coupon,
  DetailBlock,
  Order,
  OrderItem,
  OrderStatus,
  PointTransaction,
  Product,
  ProductOption,
  Promo,
  Review,
  ReviewStatus,
  User,
} from './types';
import { getMemoryStore } from './db-memory';
import { getSupabaseStore } from './db-supabase';

export interface Store {
  // 상품
  listProducts(includeInactive?: boolean): Promise<Product[]>; // sortOrder 순. 기본은 isActive=true만
  getProduct(id: string): Promise<Product | null>;
  createProduct(input: {
    name: string;
    subtitle?: string;
    imageUrl?: string | null;
    detail?: string;
    blocks?: DetailBlock[]; // 생략 시 [] (admin 생성 API는 blocks 없이 생성)
    isActive?: boolean;
    sortOrder?: number; // 생략 시 맨 뒤에 추가
  }): Promise<Product>;
  // patch 에 blocks 포함 가능 (v2.1 — Product.blocks 가 Partial 로 그대로 허용됨)
  updateProduct(id: string, patch: Partial<Omit<Product, 'id'>>): Promise<void>;
  deleteProduct(id: string): Promise<void>; // 소속 옵션 cascade 삭제
  // 옵션
  listOptions(productId?: string): Promise<ProductOption[]>; // sortOrder 순, 품절 포함. productId 생략 시 전체
  getOption(id: string): Promise<ProductOption | null>;
  createOption(input: {
    productId: string;
    name: string;
    description?: string;
    price: number;
    soldOut?: boolean;
    sortOrder?: number; // 생략 시 해당 상품의 맨 뒤에 추가
  }): Promise<ProductOption>;
  updateOption(
    id: string,
    patch: Partial<Omit<ProductOption, 'id' | 'productId'>>
  ): Promise<void>;
  deleteOption(id: string): Promise<void>;
  // 주문 — v1 그대로 + v2.9 쿠폰·포인트
  createOrder(input: {
    items: OrderItem[];
    totalAmount: number; // v2.9 — 최종 결제금액(할인 반영). 서버가 resolveBenefits로 계산해 전달
    customerName: string;
    phone: string;
    postcode: string;
    address1: string;
    address2: string;
    memo: string;
    marketingConsent?: boolean; // v2.7 — 광고성 수신 동의 (생략 시 false)
    userId?: string | null; // v2.8 — 로그인 주문이면 User.id (생략 시 null)
    // v2.9 — 쿠폰·포인트 예약(결제 전 차감). 아래 값이 있으면 createOrder가 쿠폰을 USED로
    // 전환하고 포인트를 차감·기록한다. 예약 실패(경쟁 상태) 시 BenefitReservationError.
    couponId?: string | null;
    couponDiscount?: number; // 기본 0
    pointsUsed?: number; // 기본 0
    pointsEarned?: number; // 결제완료(markPaid) 시 지급할 적립 포인트. 기본 0
  }): Promise<Order>; // orderNo 생성 포함, status PENDING
  getOrderByNo(orderNo: string): Promise<Order | null>;
  findOrder(orderNo: string, phone: string): Promise<Order | null>; // phone 숫자만 비교
  /** 비회원 주문 찾기 — 연락처+주문자명(둘 다 일치)으로 본인 주문 목록. 최신순, 최대 20건 */
  findOrdersByPhoneName(phone: string, name: string): Promise<Order[]>;
  listOrders(params?: {
    status?: OrderStatus;
    limit?: number;
  }): Promise<Order[]>; // 최신순
  markPaid(
    orderNo: string,
    p: { paymentKey: string; method: string }
  ): Promise<void>;
  updateOrder(
    orderNo: string,
    patch: {
      status?: OrderStatus;
      courier?: string | null;
      trackingNo?: string | null;
    }
  ): Promise<void>;
  // 선물·대량 주문 (다중 배송지) — v2.4
  createGiftOrder(input: {
    senderName: string;
    senderPhone: string;
    memo: string;
    shipments: Array<{
      recipientName: string;
      phone: string;
      postcode: string;
      address1: string;
      address2: string;
      giftMessage: string;
      items: OrderItem[]; // 서버가 옵션 조회로 스냅샷 채움
    }>;
    totalAmount: number;
    marketingConsent?: boolean; // v2.7 — 보내는 분(주문자) 광고성 수신 동의 (생략 시 false)
    userId?: string | null; // v2.8 — 로그인 주문이면 User.id (생략 시 null)
  }): Promise<Order>; // kind:'GIFT', orderNo 생성 포함, status PENDING
  updateShipment(
    orderNo: string,
    shipmentId: string,
    patch: { courier?: string | null; trackingNo?: string | null }
  ): Promise<void>;
  // 리뷰 — v2.2. orderNo unique(주문당 1개), 위반 시 ReviewExistsError
  createReview(input: {
    productId: string;
    orderNo: string;
    authorName: string;
    phone: string;
    rating: number;
    body: string;
    photos: string[];
  }): Promise<Review>;
  getReviewByOrderNo(orderNo: string): Promise<Review | null>;
  listReviews(params?: {
    productId?: string;
    includeHidden?: boolean;
    limit?: number;
  }): Promise<Review[]>; // 최신순
  setReviewStatus(id: string, status: ReviewStatus): Promise<void>;
  deleteReview(id: string): Promise<void>;
  // 입장 팝업 (명절 발송 캘린더) — v2.6. 단일 설정 레코드(site_settings key='promo')
  getPromo(): Promise<Promo>; // 없으면 DEFAULT_PROMO 반환
  updatePromo(patch: Partial<Promo>): Promise<void>;
  // 유저 (카카오 소셜 로그인) — v2.8. 관리자 세션과 완전 분리
  getUserByKakaoId(kakaoId: string): Promise<User | null>;
  createUser(input: { kakaoId: string; nickname: string }): Promise<User>;
  getUser(id: string): Promise<User | null>;
  listUsers(): Promise<User[]>; // 최신 가입순 (관리자 회원 조회)
  listOrdersByUser(userId: string): Promise<Order[]>; // 최신순, 본인 userId 주문만
  // 쿠폰·포인트 — v2.9
  /** 가입 시 첫 구매 쿠폰 1회 발급. 이미 보유 시 null (중복발급 방지) */
  issueSignupCoupon(userId: string): Promise<Coupon | null>;
  getCoupon(id: string): Promise<Coupon | null>;
  listCouponsByUser(userId: string): Promise<Coupon[]>; // 최신순
  /** 포토리뷰 작성 적립(REVIEW_POINT). 주문당 1회는 호출부(리뷰 unique)가 보장 */
  grantReviewPoints(userId: string, orderNo: string): Promise<void>;
  listPointTransactions(
    userId: string,
    limit?: number
  ): Promise<PointTransaction[]>; // 최신순
  /**
   * 주문 취소 + 쿠폰·포인트 반환(멱등). 이미 CANCELED면 no-op.
   * - 예약된 쿠폰(USED·used_order_no=이 주문)을 ISSUED로 복구
   * - 사용 포인트 환불(REFUND), 결제완료였다면 적립 포인트 회수(EXPIRE)
   */
  cancelOrder(orderNo: string): Promise<void>;
  /** 방치된(30분 경과) PENDING 주문의 쿠폰·포인트를 반환 — 새 주문 생성 전에 호출 */
  releaseStalePendingBenefits(userId: string): Promise<void>;
}

/**
 * 입장 팝업 기본값 — SPEC v2.6 부록 그대로.
 * 날짜 미확정이므로 enabled:false (라이브에 잘못된 날짜 노출 방지).
 * 관리자가 켜고 날짜를 채우면 노출된다. 저장소에 값이 없을 때/일부 필드 누락 시 병합 기준.
 */
export const DEFAULT_PROMO: Promo = {
  enabled: false,
  title: '추석 선물세트 예약 안내',
  body: '주문해 주신 순서대로 산지에서 순차 발송합니다.\n신선하게 받으실 수 있도록 정성껏 준비하겠습니다.',
  shipStart: null,
  shipEnd: null,
  reserveDeadline: null,
  ctaLabel: '선물 주문하기',
  ctaHref: '/order/gift',
};

/**
 * 주문당 리뷰 1개(unique) 위반 — API가 409로 해석할 수 있게 구분 가능한 에러로 던진다.
 * `err instanceof ReviewExistsError` 로 판별.
 */
export class ReviewExistsError extends Error {
  constructor(orderNo: string) {
    super(`이미 리뷰가 등록된 주문입니다: ${orderNo}`);
    this.name = 'ReviewExistsError';
  }
}

/**
 * v2.9 — 쿠폰·포인트 예약(차감) 실패. 경쟁 상태(이미 사용된 쿠폰/부족한 잔액)에서
 * createOrder 가 던진다. 주문 API 는 409로 해석해 "새로고침 후 다시" 안내.
 */
export class BenefitReservationError extends Error {
  constructor(message = '쿠폰·포인트 적용에 실패했습니다. 새로고침 후 다시 시도해 주세요.') {
    super(message);
    this.name = 'BenefitReservationError';
  }
}

/**
 * "LF-YYYYMMDD-XXXXXXXX" — 대문자 영숫자 8자리 랜덤 (헷갈리는 0/O/1/I 제외).
 * 완료/조회 페이지가 주문번호를 다루므로 열거 공격 비용을 높이기 위해
 * CSPRNG(crypto.getRandomValues) + 8자리(32^8 ≈ 1.1조 조합/일)를 사용한다.
 */
export function generateOrderNo(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000); // KST 기준 날짜
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32자 → byte % 32에 모듈로 편향 없음
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let suffix = '';
  for (const b of bytes) {
    suffix += chars[b % chars.length];
  }
  return `LF-${y}${m}${d}-${suffix}`;
}

/**
 * 상품/옵션용 짧은 랜덤 id — 소문자 영숫자 10자리.
 * 32자 문자셋(헷갈리는 l/o/0/1 제외) → byte % 32에 모듈로 편향 없음.
 */
export function generateShortId(length = 10): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = '';
  for (const b of bytes) {
    id += chars[b % chars.length];
  }
  return id;
}

/** SUPABASE_URL + 서비스 롤 키가 있으면 SupabaseStore, 없으면 MemoryStore(데모 모드) */
export function getStore(): Store {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    return getSupabaseStore();
  }
  if (url && !key) {
    console.warn(
      '[limfruits] SUPABASE_URL은 있지만 SUPABASE_SERVICE_ROLE_KEY가 없어 인메모리 데모 모드로 동작합니다.'
    );
  }
  return getMemoryStore();
}
