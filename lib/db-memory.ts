import { randomUUID } from 'crypto';
import type { Order, OrderStatus, ProductOption } from './types';
import { generateOrderNo, type Store } from './db';
import { normalizePhone } from './format';

interface MemoryData {
  options: ProductOption[];
  orders: Order[];
}

/** SPEC 시드 옵션 4개 — 가격은 placeholder (PLACEHOLDERS.md 참고) */
function seedOptions(): ProductOption[] {
  return [
    {
      id: 'home-3kg',
      name: '나주배 가정용 3kg',
      description: '5~7과 · 실속 가정용',
      price: 19000,
      soldOut: false,
      sortOrder: 1,
    },
    {
      id: 'home-5kg',
      name: '나주배 가정용 5kg',
      description: '9~11과 · 온 가족 넉넉하게',
      price: 27000,
      soldOut: false,
      sortOrder: 2,
    },
    {
      id: 'gift-5kg',
      name: '나주배 선물세트 5kg',
      description: '7~9과 · 명절 선물용',
      price: 35000,
      soldOut: false,
      sortOrder: 3,
    },
    {
      id: 'gift-7-5kg',
      name: '나주배 선물세트 7.5kg',
      description: '9~12과 · 감사한 분께 넉넉하게',
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
        optionId: 'gift-5kg',
        optionName: '나주배 선물세트 5kg',
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
        optionId: 'home-3kg',
        optionName: '나주배 가정용 3kg',
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

/** globalThis 싱글턴 — dev HMR에도 데이터 유지 */
function getData(): MemoryData {
  const g = globalThis as typeof globalThis & {
    __limfruitsMemoryDb?: MemoryData;
  };
  if (!g.__limfruitsMemoryDb) {
    g.__limfruitsMemoryDb = { options: seedOptions(), orders: seedOrders() };
  }
  return g.__limfruitsMemoryDb;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryStore implements Store {
  async listOptions(): Promise<ProductOption[]> {
    const { options } = getData();
    return clone([...options].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async getOption(id: string): Promise<ProductOption | null> {
    const option = getData().options.find((o) => o.id === id);
    return option ? clone(option) : null;
  }

  async updateOption(
    id: string,
    patch: Partial<Omit<ProductOption, 'id'>>
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
