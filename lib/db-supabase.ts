import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  DetailBlock,
  Order,
  OrderItem,
  OrderKind,
  OrderStatus,
  Product,
  ProductOption,
  Promo,
  Review,
  ReviewStatus,
  Shipment,
  User,
} from './types';
import {
  DEFAULT_PROMO,
  generateOrderNo,
  generateShortId,
  ReviewExistsError,
  type Store,
} from './db';
import { normalizePhone } from './format';
import { sanitizeDetailBlocks } from '@/app/api/admin/products/detail-blocks';

/*
 * Supabase 저장소 — 서비스 롤 키로 서버 전용 접근.
 * 테이블 컬럼은 snake_case, 앱 타입은 camelCase → 아래 매퍼에서 변환.
 *
 *  products: id, name, subtitle, image_url, detail, blocks(jsonb), is_active, sort_order
 *  product_options: id, product_id(FK → products, ON DELETE CASCADE),
 *                   name, description, price, sold_out, sort_order
 *  orders: id, order_no, status, kind, customer_name, phone, postcode, address1,
 *          address2, memo, items(jsonb), shipments(jsonb), total_amount,
 *          marketing_consent, user_id, payment_key, payment_method, paid_at,
 *          courier, tracking_no, created_at
 *  reviews: id, product_id, order_no(unique), author_name, phone, rating,
 *           body, photos(jsonb), status, created_at
 *  site_settings: key(pk), value(jsonb) — v2.6 입장 팝업은 key='promo' 한 행(Promo)
 *  users: id(uuid pk), kakao_id(unique), nickname, created_at — v2.8 카카오 로그인
 */

interface ProductRow {
  id: string;
  name: string;
  subtitle: string;
  image_url: string | null;
  detail: string;
  blocks: DetailBlock[] | unknown; // jsonb — 대시보드 직접 수정 가능성 있어 읽기 시 정화
  is_active: boolean;
  sort_order: number;
}

interface OptionRow {
  id: string;
  product_id: string;
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
  kind: OrderKind | null; // v2.4 — 구 스키마 행/컬럼 부재 방어 (읽기 시 'SINGLE' 폴백)
  customer_name: string;
  phone: string;
  postcode: string;
  address1: string;
  address2: string;
  memo: string;
  items: OrderItem[];
  shipments: Shipment[] | unknown; // jsonb — 구 스키마/대시보드 편집 방어 (읽기 시 정화)
  total_amount: number;
  marketing_consent: boolean | null; // v2.7 — 구 스키마 컬럼 부재 방어 (읽기 시 false 폴백)
  user_id: string | null; // v2.8 — 로그인 주문이면 User.id. 구 스키마/비회원은 null
  payment_key: string | null;
  payment_method: string | null;
  paid_at: string | null;
  courier: string | null;
  tracking_no: string | null;
  created_at: string;
}

interface ReviewRow {
  id: string;
  product_id: string;
  order_no: string;
  author_name: string;
  phone: string;
  rating: number;
  body: string;
  photos: string[] | unknown; // jsonb — 대시보드 직접 수정 가능성 있어 읽기 시 방어
  status: ReviewStatus;
  created_at: string;
}

interface UserRow {
  id: string;
  kakao_id: string;
  nickname: string;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    kakaoId: row.kakao_id,
    nickname: row.nickname,
    createdAt: toIso(row.created_at) ?? row.created_at,
  };
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    productId: row.product_id,
    orderNo: row.order_no,
    authorName: row.author_name,
    phone: row.phone,
    rating: row.rating,
    body: row.body,
    photos: Array.isArray(row.photos)
      ? row.photos.filter((p): p is string => typeof p === 'string')
      : [],
    status: row.status,
    createdAt: toIso(row.created_at) ?? row.created_at,
  };
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    detail: row.detail,
    // 앱 API 는 저장 전에 검증하지만, Supabase 대시보드에서 직접 수정된 jsonb 는
    // 형태 보장이 없다. 읽기 시점에 정화해 형식이 어긋난 블록은 버린다.
    blocks: sanitizeDetailBlocks(row.blocks),
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function toOption(row: OptionRow): ProductOption {
  return {
    id: row.id,
    productId: row.product_id,
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

/**
 * shipments jsonb 정화 — 구 스키마 행(컬럼 부재 → undefined)이나 대시보드에서
 * 직접 편집된 값도 안전하게 Shipment[] 로 만든다. 형태가 어긋난 항목은 필드 보정.
 */
function normalizeShipments(value: unknown): Shipment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      id: typeof s.id === 'string' ? s.id : '',
      recipientName:
        typeof s.recipientName === 'string' ? s.recipientName : '',
      phone: typeof s.phone === 'string' ? s.phone : '',
      postcode: typeof s.postcode === 'string' ? s.postcode : '',
      address1: typeof s.address1 === 'string' ? s.address1 : '',
      address2: typeof s.address2 === 'string' ? s.address2 : '',
      giftMessage: typeof s.giftMessage === 'string' ? s.giftMessage : '',
      items: Array.isArray(s.items) ? (s.items as OrderItem[]) : [],
      courier: typeof s.courier === 'string' ? s.courier : null,
      trackingNo: typeof s.trackingNo === 'string' ? s.trackingNo : null,
    }));
}

/**
 * site_settings(key='promo').value jsonb → Promo. 값이 없거나(신규 설치) 일부
 * 필드가 빠졌으면 DEFAULT_PROMO 로 채운다. 대시보드에서 직접 편집된 값도 방어.
 */
function mergePromo(value: unknown): Promo {
  const v =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const str = (x: unknown, fallback: string): string =>
    typeof x === 'string' ? x : fallback;
  const dateOrNull = (x: unknown, fallback: string | null): string | null => {
    if (x === null) return null;
    return typeof x === 'string' ? x : fallback;
  };
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_PROMO.enabled,
    title: str(v.title, DEFAULT_PROMO.title),
    body: str(v.body, DEFAULT_PROMO.body),
    shipStart: dateOrNull(v.shipStart, DEFAULT_PROMO.shipStart),
    shipEnd: dateOrNull(v.shipEnd, DEFAULT_PROMO.shipEnd),
    reserveDeadline: dateOrNull(
      v.reserveDeadline,
      DEFAULT_PROMO.reserveDeadline
    ),
    ctaLabel: str(v.ctaLabel, DEFAULT_PROMO.ctaLabel),
    ctaHref: str(v.ctaHref, DEFAULT_PROMO.ctaHref),
  };
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNo: row.order_no,
    status: row.status,
    // 구 스키마(kind 컬럼 부재 → null/undefined)는 'SINGLE' 로 폴백
    kind: row.kind === 'GIFT' ? 'GIFT' : 'SINGLE',
    customerName: row.customer_name,
    phone: row.phone,
    postcode: row.postcode,
    address1: row.address1,
    address2: row.address2,
    memo: row.memo,
    items: row.items,
    shipments: normalizeShipments(row.shipments),
    userId: row.user_id ?? null,
    totalAmount: row.total_amount,
    marketingConsent: row.marketing_consent === true,
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

/** sortOrder 미지정 시 맨 뒤에 붙이기 위한 현재 최대값 + 1 */
async function nextSortOrder(
  table: 'products' | 'product_options',
  productId?: string
): Promise<number> {
  let query = getClient()
    .from(table)
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (productId !== undefined) {
    query = query.eq('product_id', productId);
  }
  const { data, error } = await query;
  if (error) throw new Error(`정렬 순서 조회 실패: ${error.message}`);
  const rows = data as { sort_order: number }[] | null;
  return rows && rows.length > 0 ? rows[0].sort_order + 1 : 1;
}

class SupabaseStore implements Store {
  // ── 상품 ──────────────────────────────────────────────

  async listProducts(includeInactive = false): Promise<Product[]> {
    let query = getClient()
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) throw new Error(`상품 목록 조회 실패: ${error.message}`);
    return (data as ProductRow[]).map(toProduct);
  }

  async getProduct(id: string): Promise<Product | null> {
    const { data, error } = await getClient()
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`상품 조회 실패: ${error.message}`);
    return data ? toProduct(data as ProductRow) : null;
  }

  async createProduct(input: {
    name: string;
    subtitle?: string;
    imageUrl?: string | null;
    detail?: string;
    blocks?: DetailBlock[];
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<Product> {
    const sortOrder = input.sortOrder ?? (await nextSortOrder('products'));
    // 랜덤 id 유니크 충돌 시 재시도
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await getClient()
        .from('products')
        .insert({
          id: generateShortId(),
          name: input.name,
          subtitle: input.subtitle ?? '',
          image_url: input.imageUrl ?? null,
          detail: input.detail ?? '',
          blocks: input.blocks ?? [],
          is_active: input.isActive ?? true,
          sort_order: sortOrder,
        })
        .select('*')
        .single();
      if (!error) return toProduct(data as ProductRow);
      if (error.code !== '23505') {
        throw new Error(`상품 생성 실패: ${error.message}`);
      }
    }
    throw new Error('상품 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }

  async updateProduct(
    id: string,
    patch: Partial<Omit<Product, 'id'>>
  ): Promise<void> {
    const row: Partial<Omit<ProductRow, 'id'>> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.subtitle !== undefined) row.subtitle = patch.subtitle;
    if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
    if (patch.detail !== undefined) row.detail = patch.detail;
    if (patch.blocks !== undefined) row.blocks = patch.blocks;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (Object.keys(row).length === 0) return;

    const { error } = await getClient()
      .from('products')
      .update(row)
      .eq('id', id);
    if (error) throw new Error(`상품 수정 실패: ${error.message}`);
  }

  /** 소속 옵션은 DB FK(ON DELETE CASCADE)가 함께 삭제 */
  async deleteProduct(id: string): Promise<void> {
    const { error } = await getClient().from('products').delete().eq('id', id);
    if (error) throw new Error(`상품 삭제 실패: ${error.message}`);
  }

  // ── 옵션 ──────────────────────────────────────────────

  async listOptions(productId?: string): Promise<ProductOption[]> {
    let query = getClient()
      .from('product_options')
      .select('*')
      .order('sort_order', { ascending: true });
    if (productId !== undefined) {
      query = query.eq('product_id', productId);
    }
    const { data, error } = await query;
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

  async createOption(input: {
    productId: string;
    name: string;
    description?: string;
    price: number;
    soldOut?: boolean;
    sortOrder?: number;
  }): Promise<ProductOption> {
    const sortOrder =
      input.sortOrder ??
      (await nextSortOrder('product_options', input.productId));
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await getClient()
        .from('product_options')
        .insert({
          id: generateShortId(),
          product_id: input.productId,
          name: input.name,
          description: input.description ?? '',
          price: input.price,
          sold_out: input.soldOut ?? false,
          sort_order: sortOrder,
        })
        .select('*')
        .single();
      if (!error) return toOption(data as OptionRow);
      if (error.code === '23503') {
        // FK 위반 — 소속 상품 없음
        throw new Error(`상품을 찾을 수 없습니다: ${input.productId}`);
      }
      if (error.code !== '23505') {
        throw new Error(`옵션 생성 실패: ${error.message}`);
      }
    }
    throw new Error('옵션 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }

  async updateOption(
    id: string,
    patch: Partial<Omit<ProductOption, 'id' | 'productId'>>
  ): Promise<void> {
    const row: Partial<Omit<OptionRow, 'id' | 'product_id'>> = {};
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

  async deleteOption(id: string): Promise<void> {
    const { error } = await getClient()
      .from('product_options')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`옵션 삭제 실패: ${error.message}`);
  }

  // ── 주문 (v1 그대로) ──────────────────────────────────

  async createOrder(input: {
    items: OrderItem[];
    totalAmount: number;
    customerName: string;
    phone: string;
    postcode: string;
    address1: string;
    address2: string;
    memo: string;
    marketingConsent?: boolean;
    userId?: string | null;
  }): Promise<Order> {
    // 주문번호 유니크 충돌 시 재시도
    for (let attempt = 0; attempt < 5; attempt++) {
      const orderNo = generateOrderNo();
      const { data, error } = await getClient()
        .from('orders')
        .insert({
          order_no: orderNo,
          status: 'PENDING',
          kind: 'SINGLE' satisfies OrderKind,
          customer_name: input.customerName,
          phone: normalizePhone(input.phone),
          postcode: input.postcode,
          address1: input.address1,
          address2: input.address2,
          memo: input.memo,
          items: input.items,
          shipments: [],
          user_id: input.userId ?? null,
          total_amount: input.totalAmount,
          marketing_consent: input.marketingConsent ?? false,
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

  // ── 선물·대량 주문 (다중 배송지, v2.4) ────────────────

  async createGiftOrder(input: {
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
      items: OrderItem[];
    }>;
    totalAmount: number;
    marketingConsent?: boolean;
    userId?: string | null;
  }): Promise<Order> {
    // 배송 건 id 는 이 주문의 shipments 안에서만 유일하면 됨
    const shipments: Shipment[] = [];
    for (const s of input.shipments) {
      let id = generateShortId();
      while (shipments.some((x) => x.id === id)) id = generateShortId();
      shipments.push({
        id,
        recipientName: s.recipientName,
        phone: normalizePhone(s.phone),
        postcode: s.postcode,
        address1: s.address1,
        address2: s.address2,
        giftMessage: s.giftMessage,
        items: s.items,
        courier: null,
        trackingNo: null,
      });
    }
    // 총액 계산·하위호환용: 모든 배송 건 items 를 평탄화한 합
    const items = shipments.flatMap((s) => s.items);

    // 주문번호 유니크 충돌 시 재시도
    for (let attempt = 0; attempt < 5; attempt++) {
      const orderNo = generateOrderNo();
      const { data, error } = await getClient()
        .from('orders')
        .insert({
          order_no: orderNo,
          status: 'PENDING',
          kind: 'GIFT' satisfies OrderKind,
          // GIFT: top-level 이름/연락처 = 보내는 분(주문자), 주소는 빈 문자열
          customer_name: input.senderName,
          phone: normalizePhone(input.senderPhone),
          postcode: '',
          address1: '',
          address2: '',
          memo: input.memo,
          items,
          shipments,
          user_id: input.userId ?? null,
          total_amount: input.totalAmount,
          marketing_consent: input.marketingConsent ?? false,
        })
        .select('*')
        .single();
      if (!error) return toOrder(data as OrderRow);
      if (error.code !== '23505') {
        throw new Error(`선물 주문 생성 실패: ${error.message}`);
      }
    }
    throw new Error('주문번호 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }

  /** 배송 건 하나의 courier/trackingNo만 갱신 — jsonb 배열을 read-modify-write */
  async updateShipment(
    orderNo: string,
    shipmentId: string,
    patch: { courier?: string | null; trackingNo?: string | null }
  ): Promise<void> {
    const { data, error } = await getClient()
      .from('orders')
      .select('shipments')
      .eq('order_no', orderNo)
      .maybeSingle();
    if (error) throw new Error(`배송 건 조회 실패: ${error.message}`);
    if (!data) throw new Error(`주문을 찾을 수 없습니다: ${orderNo}`);

    const shipments = normalizeShipments(
      (data as { shipments: unknown }).shipments
    );
    const shipment = shipments.find((s) => s.id === shipmentId);
    if (!shipment) {
      throw new Error(`배송 건을 찾을 수 없습니다: ${orderNo} / ${shipmentId}`);
    }
    if (patch.courier !== undefined) shipment.courier = patch.courier;
    if (patch.trackingNo !== undefined) shipment.trackingNo = patch.trackingNo;

    const { error: updateError } = await getClient()
      .from('orders')
      .update({ shipments })
      .eq('order_no', orderNo);
    if (updateError) {
      throw new Error(`배송 건 수정 실패: ${updateError.message}`);
    }
  }

  // ── 리뷰 (v2.2) ───────────────────────────────────────

  async createReview(input: {
    productId: string;
    orderNo: string;
    authorName: string;
    phone: string;
    rating: number;
    body: string;
    photos: string[];
  }): Promise<Review> {
    const { data, error } = await getClient()
      .from('reviews')
      .insert({
        product_id: input.productId,
        order_no: input.orderNo,
        author_name: input.authorName,
        phone: normalizePhone(input.phone),
        rating: input.rating,
        body: input.body,
        photos: input.photos,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        // unique(order_no) 위반 = 이미 리뷰 존재 — API가 409로 해석
        throw new ReviewExistsError(input.orderNo);
      }
      throw new Error(`리뷰 등록 실패: ${error.message}`);
    }
    return toReview(data as ReviewRow);
  }

  async getReviewByOrderNo(orderNo: string): Promise<Review | null> {
    const { data, error } = await getClient()
      .from('reviews')
      .select('*')
      .eq('order_no', orderNo)
      .maybeSingle();
    if (error) throw new Error(`리뷰 조회 실패: ${error.message}`);
    return data ? toReview(data as ReviewRow) : null;
  }

  async listReviews(params?: {
    productId?: string;
    includeHidden?: boolean;
    limit?: number;
  }): Promise<Review[]> {
    let query = getClient()
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
    if (params?.productId !== undefined) {
      query = query.eq('product_id', params.productId);
    }
    if (!params?.includeHidden) {
      query = query.eq('status', 'VISIBLE' satisfies ReviewStatus);
    }
    if (params?.limit !== undefined) query = query.limit(params.limit);
    const { data, error } = await query;
    if (error) throw new Error(`리뷰 목록 조회 실패: ${error.message}`);
    return (data as ReviewRow[]).map(toReview);
  }

  async setReviewStatus(id: string, status: ReviewStatus): Promise<void> {
    const { error } = await getClient()
      .from('reviews')
      .update({ status })
      .eq('id', id);
    if (error) throw new Error(`리뷰 상태 변경 실패: ${error.message}`);
  }

  async deleteReview(id: string): Promise<void> {
    const { error } = await getClient().from('reviews').delete().eq('id', id);
    if (error) throw new Error(`리뷰 삭제 실패: ${error.message}`);
  }

  // ── 입장 팝업 (v2.6) — site_settings key='promo' 단일 행 ───

  async getPromo(): Promise<Promo> {
    const { data, error } = await getClient()
      .from('site_settings')
      .select('value')
      .eq('key', 'promo')
      .maybeSingle();
    if (error) {
      // site_settings 테이블이 아직 없거나(신규 설치·미마이그레이션) 조회가 실패해도
      // getPromo 는 손님용 (site) 레이아웃 전체가 읽는다 → 여기서 throw 하면 홈·주문·
      // 주문조회 등 모든 storefront 페이지가 500 난다. 기본값(enabled:false → 팝업
      // 미노출)으로 강등해 사이트를 살리고, 관리자가 schema.sql 의 site_settings 절을
      // 실행하면 정상 동작한다. (v2.2 리뷰 조회 실패 강등과 동일한 방침)
      console.warn(
        `[limfruits] 팝업 설정 조회 실패 — 기본값으로 대체합니다: ${error.message}`
      );
      return { ...DEFAULT_PROMO };
    }
    return mergePromo(data ? (data as { value: unknown }).value : null);
  }

  async updatePromo(patch: Partial<Promo>): Promise<void> {
    // 현재 값(없으면 기본값 병합)에 patch 를 얹어 전체 jsonb 를 upsert
    const current = await this.getPromo();
    const next: Promo = { ...current };
    if (patch.enabled !== undefined) next.enabled = patch.enabled;
    if (patch.title !== undefined) next.title = patch.title;
    if (patch.body !== undefined) next.body = patch.body;
    if (patch.shipStart !== undefined) next.shipStart = patch.shipStart;
    if (patch.shipEnd !== undefined) next.shipEnd = patch.shipEnd;
    if (patch.reserveDeadline !== undefined)
      next.reserveDeadline = patch.reserveDeadline;
    if (patch.ctaLabel !== undefined) next.ctaLabel = patch.ctaLabel;
    if (patch.ctaHref !== undefined) next.ctaHref = patch.ctaHref;

    const { error } = await getClient()
      .from('site_settings')
      .upsert({ key: 'promo', value: next }, { onConflict: 'key' });
    if (error) throw new Error(`팝업 설정 저장 실패: ${error.message}`);
  }

  // ── 유저 (카카오 소셜 로그인, v2.8) — 관리자 세션과 완전 분리 ───

  async getUserByKakaoId(kakaoId: string): Promise<User | null> {
    const { data, error } = await getClient()
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoId)
      .maybeSingle();
    if (error) throw new Error(`유저 조회 실패: ${error.message}`);
    return data ? toUser(data as UserRow) : null;
  }

  async createUser(input: {
    kakaoId: string;
    nickname: string;
  }): Promise<User> {
    const { data, error } = await getClient()
      .from('users')
      .insert({ kakao_id: input.kakaoId, nickname: input.nickname })
      .select('*')
      .single();
    if (error) {
      // kakao_id unique 위반(경쟁 상태) — 이미 만들어진 유저를 반환
      if (error.code === '23505') {
        const existing = await this.getUserByKakaoId(input.kakaoId);
        if (existing) return existing;
      }
      throw new Error(`유저 생성 실패: ${error.message}`);
    }
    return toUser(data as UserRow);
  }

  async getUser(id: string): Promise<User | null> {
    const { data, error } = await getClient()
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`유저 조회 실패: ${error.message}`);
    return data ? toUser(data as UserRow) : null;
  }

  async listOrdersByUser(userId: string): Promise<Order[]> {
    const { data, error } = await getClient()
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`내 주문 목록 조회 실패: ${error.message}`);
    return (data as OrderRow[]).map(toOrder);
  }
}

let supabaseStore: SupabaseStore | null = null;

export function getSupabaseStore(): Store {
  if (!supabaseStore) {
    supabaseStore = new SupabaseStore();
  }
  return supabaseStore;
}
