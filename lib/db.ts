import type {
  DetailBlock,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductOption,
  Review,
  ReviewStatus,
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
  // 주문 — v1 그대로
  createOrder(input: {
    items: OrderItem[];
    totalAmount: number;
    customerName: string;
    phone: string;
    postcode: string;
    address1: string;
    address2: string;
    memo: string;
  }): Promise<Order>; // orderNo 생성 포함, status PENDING
  getOrderByNo(orderNo: string): Promise<Order | null>;
  findOrder(orderNo: string, phone: string): Promise<Order | null>; // phone 숫자만 비교
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
}

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
