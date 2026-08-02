import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderItem, OrderStatus, ProductOption } from './types';
import { generateOrderNo, type Store } from './db';
import { normalizePhone } from './format';

/*
 * Supabase 저장소 — 서비스 롤 키로 서버 전용 접근.
 * 테이블 컬럼은 snake_case, 앱 타입은 camelCase → 아래 매퍼에서 변환.
 *
 *  product_options: id, name, description, price, sold_out, sort_order
 *  orders: id, order_no, status, customer_name, phone, postcode, address1,
 *          address2, memo, items(jsonb), total_amount, payment_key,
 *          payment_method, paid_at, courier, tracking_no, created_at
 */

interface OptionRow {
  id: string;
  name: string;
  description: string;
  price: number;
  sold_out: boolean;
  sort_order: number;
}

interface OrderRow {
  id: string;
  order_no: string;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  postcode: string;
  address1: string;
  address2: string;
  memo: string;
  items: OrderItem[];
  total_amount: number;
  payment_key: string | null;
  payment_method: string | null;
  paid_at: string | null;
  courier: string | null;
  tracking_no: string | null;
  created_at: string;
}

function toOption(row: OptionRow): ProductOption {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    soldOut: row.sold_out,
    sortOrder: row.sort_order,
  };
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNo: row.order_no,
    status: row.status,
    customerName: row.customer_name,
    phone: row.phone,
    postcode: row.postcode,
    address1: row.address1,
    address2: row.address2,
    memo: row.memo,
    items: row.items,
    totalAmount: row.total_amount,
    paymentKey: row.payment_key,
    paymentMethod: row.payment_method,
    paidAt: toIso(row.paid_at),
    courier: row.courier,
    trackingNo: row.tracking_no,
    createdAt: toIso(row.created_at) ?? row.created_at,
  };
}

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.'
    );
  }
  const g = globalThis as typeof globalThis & {
    __limfruitsSupabase?: SupabaseClient;
  };
  if (!g.__limfruitsSupabase) {
    g.__limfruitsSupabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return g.__limfruitsSupabase;
}

class SupabaseStore implements Store {
  async listOptions(): Promise<ProductOption[]> {
    const { data, error } = await getClient()
      .from('product_options')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw new Error(`옵션 목록 조회 실패: ${error.message}`);
    return (data as OptionRow[]).map(toOption);
  }

  async getOption(id: string): Promise<ProductOption | null> {
    const { data, error } = await getClient()
      .from('product_options')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`옵션 조회 실패: ${error.message}`);
    return data ? toOption(data as OptionRow) : null;
  }

  async updateOption(
    id: string,
    patch: Partial<Omit<ProductOption, 'id'>>
  ): Promise<void> {
    const row: Partial<OptionRow> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.price !== undefined) row.price = patch.price;
    if (patch.soldOut !== undefined) row.sold_out = patch.soldOut;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (Object.keys(row).length === 0) return;

    const { error } = await getClient()
      .from('product_options')
      .update(row)
      .eq('id', id);
    if (error) throw new Error(`옵션 수정 실패: ${error.message}`);
  }

  async createOrder(input: {
    items: OrderItem[];
    totalAmount: number;
    customerName: string;
    phone: string;
    postcode: string;
    address1: string;
    address2: string;
    memo: string;
  }): Promise<Order> {
    // 주문번호 유니크 충돌 시 재시도
    for (let attempt = 0; attempt < 5; attempt++) {
      const orderNo = generateOrderNo();
      const { data, error } = await getClient()
        .from('orders')
        .insert({
          order_no: orderNo,
          status: 'PENDING',
          customer_name: input.customerName,
          phone: normalizePhone(input.phone),
          postcode: input.postcode,
          address1: input.address1,
          address2: input.address2,
          memo: input.memo,
          items: input.items,
          total_amount: input.totalAmount,
        })
        .select('*')
        .single();
      if (!error) return toOrder(data as OrderRow);
      if (error.code !== '23505') {
        throw new Error(`주문 생성 실패: ${error.message}`);
      }
    }
    throw new Error('주문번호 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }

  async getOrderByNo(orderNo: string): Promise<Order | null> {
    const { data, error } = await getClient()
      .from('orders')
      .select('*')
      .eq('order_no', orderNo)
      .maybeSingle();
    if (error) throw new Error(`주문 조회 실패: ${error.message}`);
    return data ? toOrder(data as OrderRow) : null;
  }

  async findOrder(orderNo: string, phone: string): Promise<Order | null> {
    const order = await this.getOrderByNo(orderNo);
    if (!order) return null;
    if (normalizePhone(order.phone) !== normalizePhone(phone)) return null;
    return order;
  }

  async listOrders(params?: {
    status?: OrderStatus;
    limit?: number;
  }): Promise<Order[]> {
    let query = getClient()
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (params?.status) query = query.eq('status', params.status);
    if (params?.limit !== undefined) query = query.limit(params.limit);
    const { data, error } = await query;
    if (error) throw new Error(`주문 목록 조회 실패: ${error.message}`);
    return (data as OrderRow[]).map(toOrder);
  }

  async markPaid(
    orderNo: string,
    p: { paymentKey: string; method: string }
  ): Promise<void> {
    const { error } = await getClient()
      .from('orders')
      .update({
        status: 'PAID' satisfies OrderStatus,
        payment_key: p.paymentKey,
        payment_method: p.method,
        paid_at: new Date().toISOString(),
      })
      .eq('order_no', orderNo);
    if (error) throw new Error(`결제 반영 실패: ${error.message}`);
  }

  async updateOrder(
    orderNo: string,
    patch: {
      status?: OrderStatus;
      courier?: string | null;
      trackingNo?: string | null;
    }
  ): Promise<void> {
    const row: Partial<Pick<OrderRow, 'status' | 'courier' | 'tracking_no'>> =
      {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.courier !== undefined) row.courier = patch.courier;
    if (patch.trackingNo !== undefined) row.tracking_no = patch.trackingNo;
    if (Object.keys(row).length === 0) return;

    const { error } = await getClient()
      .from('orders')
      .update(row)
      .eq('order_no', orderNo);
    if (error) throw new Error(`주문 수정 실패: ${error.message}`);
  }
}

let supabaseStore: SupabaseStore | null = null;

export function getSupabaseStore(): Store {
  if (!supabaseStore) {
    supabaseStore = new SupabaseStore();
  }
  return supabaseStore;
}
