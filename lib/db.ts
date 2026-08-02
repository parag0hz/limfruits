import type { Order, OrderItem, OrderStatus, ProductOption } from './types';
import { getMemoryStore } from './db-memory';
import { getSupabaseStore } from './db-supabase';

export interface Store {
  listOptions(): Promise<ProductOption[]>; // sortOrder 순, 품절 포함
  getOption(id: string): Promise<ProductOption | null>;
  updateOption(
    id: string,
    patch: Partial<Omit<ProductOption, 'id'>>
  ): Promise<void>;
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
