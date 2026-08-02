import { randomUUID } from 'crypto';
import type {
  DetailBlock,
  Order,
  OrderStatus,
  Product,
  ProductOption,
} from './types';
import { generateOrderNo, generateShortId, type Store } from './db';
import { normalizePhone } from './format';

interface MemoryData {
  products: Product[];
  options: ProductOption[];
  orders: Order[];
}

/**
 * 나주배 상세 본문 — 빈 줄로 문단 구분. 확인되지 않은 구체 사실(수상, N대째 등) 없음.
 * BRAND v2 카피 톤: 감성 서사 없이 산지·프로세스·규격·식감·보관법 중심.
 * supabase/schema.sql 시드와 반드시 동일하게 유지할 것.
 */
const NAJU_PEAR_DETAIL = [
  '나주는 일조량이 풍부하고 일교차가 큰 배 재배 적지입니다. 이곳에서 자란 배는 과육이 아삭하고 과즙이 많으며, 시원하고 깔끔한 단맛이 특징입니다.',
  '임과일은 전남 나주에서 과수원을 직접 운영합니다. 재배부터 수확, 선별, 포장까지 전 과정을 농장에서 관리하고, 주문 확인 후 산지에서 바로 발송합니다. 중간 유통 단계가 없어 수확 후 도착까지 걸리는 시간이 짧습니다.',
  '구성은 가정용 3kg·5kg, 선물세트 5kg·7.5kg 중에서 선택할 수 있습니다. 중량과 과수 규격은 각 옵션 설명에 표기되어 있습니다.',
  '받으신 배는 한 개씩 종이에 싸서 냉장 보관하면 오래 신선하게 유지됩니다. 상온에 둘 경우 서늘하고 통풍이 잘 되는 곳에 보관해 주세요.',
].join('\n\n');

/**
 * v2.1 카드뉴스형 상세 블록 시드 — SPEC v2.1 부록 "저장 > 시드" 절 그대로.
 * 확인 안 된 구체 수치는 placeholder("OO brix", "O~O과")로 두고 PLACEHOLDERS.md에 기록.
 * 인증 배지(badge)·사진(image) 블록은 시드에서 생략 (PLACEHOLDERS.md 참고).
 * supabase/schema.sql 시드와 반드시 동일하게 유지할 것.
 */
const NAJU_PEAR_BLOCKS: DetailBlock[] = [
  {
    type: 'heading',
    label: '임과일 나주배',
    title: '나주에서 수확한 그대로.',
  },
  {
    type: 'text',
    body: '나주는 일조량이 풍부하고 토질이 배 재배에 알맞아 오래전부터 배 산지로 알려진 곳입니다.\n\n이곳에서 자란 배는 과육이 아삭하고 과즙이 풍부하며, 시원하고 깔끔한 단맛이 특징입니다.',
  },
  {
    type: 'point',
    title: '산지 직송',
    body: '농장에서 경매장, 도매상, 소매점을 거치는 일반적인 유통 대신 농장에서 택배로 바로 발송합니다. 중간 단계가 없어 수확 후 도착까지 걸리는 시간이 짧습니다.',
  },
  {
    type: 'point',
    title: '당도 관리',
    body: '당도가 충분히 오른 시기를 확인한 뒤 수확해 발송합니다. 기준 당도는 OO brix 이상입니다.',
  },
  {
    type: 'point',
    title: '재배부터 포장까지 직접',
    body: '재배부터 수확, 선별, 포장까지 전 과정을 농장에서 직접 진행합니다. 주문 확인 후 산지에서 발송합니다.',
  },
  {
    type: 'specs',
    title: '상품 구성',
    rows: [
      { k: '가정용 3kg', v: 'O~O과' },
      { k: '가정용 5kg', v: 'O~O과' },
      { k: '선물세트 5kg', v: 'O~O과' },
      { k: '선물세트 7.5kg', v: 'O~O과' },
    ],
  },
  {
    type: 'notice',
    title: '포장·배송 안내',
    body: '배 하나하나 완충재로 감싸 배송 중 충격을 줄입니다. 수확 후 신속히 발송하며, 농산물 특성상 크기와 모양은 사진과 다소 다를 수 있습니다.',
  },
  {
    type: 'heading',
    label: '생산지',
    title: '전라남도 나주시',
  },
  {
    type: 'text',
    body: '전라남도 나주시 덕룡로 33-8 (풍천대봉감농원)에서 재배하고 발송합니다.',
  },
];

/** SPEC v2 시드 상품 1개 — 나주배만 */
function seedProducts(): Product[] {
  return [
    {
      id: 'naju-pear',
      name: '나주배',
      subtitle: '아삭하고 과즙 가득, 산지에서 바로 보내드려요',
      imageUrl: null,
      detail: NAJU_PEAR_DETAIL,
      blocks: NAJU_PEAR_BLOCKS,
      isActive: true,
      sortOrder: 1,
    },
  ];
}

/**
 * SPEC 시드 옵션 4개 — 상품 소속이므로 이름에서 "나주배" 접두 제거.
 * 가격·과수는 placeholder (PLACEHOLDERS.md 참고). 과수는 상세 블록의
 * "상품 구성" 표(O~O과)와 같은 placeholder 로 맞춰 확인 전 임의 수치가
 * 실제 정보처럼 보이지 않게 한다.
 */
function seedOptions(): ProductOption[] {
  return [
    {
      id: 'home-3kg',
      productId: 'naju-pear',
      name: '가정용 3kg',
      description: 'O~O과 · 실속 가정용',
      price: 19000,
      soldOut: false,
      sortOrder: 1,
    },
    {
      id: 'home-5kg',
      productId: 'naju-pear',
      name: '가정용 5kg',
      description: 'O~O과 · 넉넉한 가정용',
      price: 27000,
      soldOut: false,
      sortOrder: 2,
    },
    {
      id: 'gift-5kg',
      productId: 'naju-pear',
      name: '선물세트 5kg',
      description: 'O~O과 · 명절 선물용',
      price: 35000,
      soldOut: false,
      sortOrder: 3,
    },
    {
      id: 'gift-7-5kg',
      productId: 'naju-pear',
      name: '선물세트 7.5kg',
      description: 'O~O과 · 대용량 선물세트',
      price: 45000,
      soldOut: false,
      sortOrder: 4,
    },
  ];
}

/** 예시 주문 2개 — 이름에 "(예시)" 표기. paymentKey는 null(가짜 키로 토스 취소 API가 호출되는 것 방지) */
function seedOrders(): Order[] {
  const now = Date.now();
  const yesterday = new Date(now - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);

  const paidOrder: Order = {
    id: randomUUID(),
    orderNo: generateOrderNo(yesterday),
    status: 'PAID',
    customerName: '김나주 (예시)',
    phone: '01012345678',
    postcode: '58210',
    address1: '전라남도 나주시 예시로 12',
    address2: '101동 202호',
    memo: '문 앞에 놓아주세요',
    items: [
      {
        productId: 'naju-pear',
        productName: '나주배',
        optionId: 'gift-5kg',
        optionName: '선물세트 5kg',
        unitPrice: 35000,
        quantity: 1,
      },
    ],
    totalAmount: 35000,
    paymentKey: null,
    paymentMethod: '카드',
    paidAt: yesterday.toISOString(),
    courier: null,
    trackingNo: null,
    createdAt: yesterday.toISOString(),
  };

  const shippingOrder: Order = {
    id: randomUUID(),
    orderNo: generateOrderNo(threeDaysAgo),
    status: 'SHIPPING',
    customerName: '이배꽃 (예시)',
    phone: '01098765432',
    postcode: '06236',
    address1: '서울특별시 강남구 예시대로 345',
    address2: '',
    memo: '',
    items: [
      {
        productId: 'naju-pear',
        productName: '나주배',
        optionId: 'home-3kg',
        optionName: '가정용 3kg',
        unitPrice: 19000,
        quantity: 2,
      },
    ],
    totalAmount: 38000,
    paymentKey: null,
    paymentMethod: '간편결제',
    paidAt: threeDaysAgo.toISOString(),
    courier: '우체국택배',
    trackingNo: '6012345678901',
    createdAt: threeDaysAgo.toISOString(),
  };

  return [paidOrder, shippingOrder];
}

/**
 * globalThis 싱글턴 — dev HMR에도 데이터 유지.
 * 스키마가 바뀔 때마다 키를 올린다(구 스키마 데이터와 충돌 방지).
 * v2.1: Product.blocks 추가 — blocks 없는 v2 상품 객체가 남아 있으면
 * product.blocks.length 접근에서 죽으므로 키를 올려 새로 시드한다.
 */
function getData(): MemoryData {
  const g = globalThis as typeof globalThis & {
    __limfruitsMemoryDbV2_1?: MemoryData;
  };
  if (!g.__limfruitsMemoryDbV2_1) {
    g.__limfruitsMemoryDbV2_1 = {
      products: seedProducts(),
      options: seedOptions(),
      orders: seedOrders(),
    };
  }
  return g.__limfruitsMemoryDbV2_1;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** 컬렉션 안에서 안 겹치는 짧은 랜덤 id */
function uniqueShortId(existing: { id: string }[]): string {
  let id = generateShortId();
  while (existing.some((e) => e.id === id)) {
    id = generateShortId();
  }
  return id;
}

function nextSortOrder(items: { sortOrder: number }[]): number {
  return items.length === 0
    ? 1
    : Math.max(...items.map((i) => i.sortOrder)) + 1;
}

class MemoryStore implements Store {
  // ── 상품 ──────────────────────────────────────────────

  async listProducts(includeInactive = false): Promise<Product[]> {
    let products = [...getData().products];
    if (!includeInactive) {
      products = products.filter((p) => p.isActive);
    }
    return clone(products.sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async getProduct(id: string): Promise<Product | null> {
    const product = getData().products.find((p) => p.id === id);
    return product ? clone(product) : null;
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
    const data = getData();
    const product: Product = {
      id: uniqueShortId(data.products),
      name: input.name,
      subtitle: input.subtitle ?? '',
      imageUrl: input.imageUrl ?? null,
      detail: input.detail ?? '',
      blocks: input.blocks ? clone(input.blocks) : [],
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? nextSortOrder(data.products),
    };
    data.products.push(product);
    return clone(product);
  }

  async updateProduct(
    id: string,
    patch: Partial<Omit<Product, 'id'>>
  ): Promise<void> {
    const product = getData().products.find((p) => p.id === id);
    if (!product) {
      throw new Error(`상품을 찾을 수 없습니다: ${id}`);
    }
    if (patch.name !== undefined) product.name = patch.name;
    if (patch.subtitle !== undefined) product.subtitle = patch.subtitle;
    if (patch.imageUrl !== undefined) product.imageUrl = patch.imageUrl;
    if (patch.detail !== undefined) product.detail = patch.detail;
    if (patch.blocks !== undefined) product.blocks = clone(patch.blocks);
    if (patch.isActive !== undefined) product.isActive = patch.isActive;
    if (patch.sortOrder !== undefined) product.sortOrder = patch.sortOrder;
  }

  /** 소속 옵션도 함께 삭제. 없는 id면 조용히 무시(멱등 — Supabase delete와 동일 동작) */
  async deleteProduct(id: string): Promise<void> {
    const data = getData();
    data.products = data.products.filter((p) => p.id !== id);
    data.options = data.options.filter((o) => o.productId !== id);
  }

  // ── 옵션 ──────────────────────────────────────────────

  async listOptions(productId?: string): Promise<ProductOption[]> {
    let options = [...getData().options];
    if (productId !== undefined) {
      options = options.filter((o) => o.productId === productId);
    }
    return clone(options.sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async getOption(id: string): Promise<ProductOption | null> {
    const option = getData().options.find((o) => o.id === id);
    return option ? clone(option) : null;
  }

  async createOption(input: {
    productId: string;
    name: string;
    description?: string;
    price: number;
    soldOut?: boolean;
    sortOrder?: number;
  }): Promise<ProductOption> {
    const data = getData();
    if (!data.products.some((p) => p.id === input.productId)) {
      // Supabase에서는 FK 제약이 하는 검증을 여기서 동일하게 수행
      throw new Error(`상품을 찾을 수 없습니다: ${input.productId}`);
    }
    const siblings = data.options.filter(
      (o) => o.productId === input.productId
    );
    const option: ProductOption = {
      id: uniqueShortId(data.options),
      productId: input.productId,
      name: input.name,
      description: input.description ?? '',
      price: input.price,
      soldOut: input.soldOut ?? false,
      sortOrder: input.sortOrder ?? nextSortOrder(siblings),
    };
    data.options.push(option);
    return clone(option);
  }

  async updateOption(
    id: string,
    patch: Partial<Omit<ProductOption, 'id' | 'productId'>>
  ): Promise<void> {
    const option = getData().options.find((o) => o.id === id);
    if (!option) {
      throw new Error(`상품 옵션을 찾을 수 없습니다: ${id}`);
    }
    if (patch.name !== undefined) option.name = patch.name;
    if (patch.description !== undefined) option.description = patch.description;
    if (patch.price !== undefined) option.price = patch.price;
    if (patch.soldOut !== undefined) option.soldOut = patch.soldOut;
    if (patch.sortOrder !== undefined) option.sortOrder = patch.sortOrder;
  }

  /** 없는 id면 조용히 무시(멱등 — Supabase delete와 동일 동작) */
  async deleteOption(id: string): Promise<void> {
    const data = getData();
    data.options = data.options.filter((o) => o.id !== id);
  }

  // ── 주문 (v1 그대로) ──────────────────────────────────

  async createOrder(input: {
    items: Order['items'];
    totalAmount: number;
    customerName: string;
    phone: string;
    postcode: string;
    address1: string;
    address2: string;
    memo: string;
  }): Promise<Order> {
    const data = getData();
    let orderNo = generateOrderNo();
    while (data.orders.some((o) => o.orderNo === orderNo)) {
      orderNo = generateOrderNo();
    }
    const order: Order = {
      id: randomUUID(),
      orderNo,
      status: 'PENDING',
      customerName: input.customerName,
      phone: normalizePhone(input.phone),
      postcode: input.postcode,
      address1: input.address1,
      address2: input.address2,
      memo: input.memo,
      items: clone(input.items),
      totalAmount: input.totalAmount,
      paymentKey: null,
      paymentMethod: null,
      paidAt: null,
      courier: null,
      trackingNo: null,
      createdAt: new Date().toISOString(),
    };
    data.orders.push(order);
    return clone(order);
  }

  async getOrderByNo(orderNo: string): Promise<Order | null> {
    const order = getData().orders.find((o) => o.orderNo === orderNo);
    return order ? clone(order) : null;
  }

  async findOrder(orderNo: string, phone: string): Promise<Order | null> {
    const order = getData().orders.find((o) => o.orderNo === orderNo);
    if (!order) return null;
    if (normalizePhone(order.phone) !== normalizePhone(phone)) return null;
    return clone(order);
  }

  async listOrders(params?: {
    status?: OrderStatus;
    limit?: number;
  }): Promise<Order[]> {
    let orders = [...getData().orders];
    if (params?.status) {
      orders = orders.filter((o) => o.status === params.status);
    }
    orders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (params?.limit !== undefined) {
      orders = orders.slice(0, params.limit);
    }
    return clone(orders);
  }

  async markPaid(
    orderNo: string,
    p: { paymentKey: string; method: string }
  ): Promise<void> {
    const order = getData().orders.find((o) => o.orderNo === orderNo);
    if (!order) {
      throw new Error(`주문을 찾을 수 없습니다: ${orderNo}`);
    }
    order.status = 'PAID';
    order.paymentKey = p.paymentKey;
    order.paymentMethod = p.method;
    order.paidAt = new Date().toISOString();
  }

  async updateOrder(
    orderNo: string,
    patch: {
      status?: OrderStatus;
      courier?: string | null;
      trackingNo?: string | null;
    }
  ): Promise<void> {
    const order = getData().orders.find((o) => o.orderNo === orderNo);
    if (!order) {
      throw new Error(`주문을 찾을 수 없습니다: ${orderNo}`);
    }
    if (patch.status !== undefined) order.status = patch.status;
    if (patch.courier !== undefined) order.courier = patch.courier;
    if (patch.trackingNo !== undefined) order.trackingNo = patch.trackingNo;
  }
}

let memoryStore: MemoryStore | null = null;

export function getMemoryStore(): Store {
  if (!memoryStore) {
    memoryStore = new MemoryStore();
  }
  return memoryStore;
}
