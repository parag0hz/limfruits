import { randomUUID } from 'crypto';
import type {
  DetailBlock,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductOption,
  Promo,
  Review,
  ReviewStatus,
  Shipment,
} from './types';
import {
  DEFAULT_PROMO,
  generateOrderNo,
  generateShortId,
  ReviewExistsError,
  type Store,
} from './db';
import { normalizePhone } from './format';

interface MemoryData {
  products: Product[];
  options: ProductOption[];
  orders: Order[];
  reviews: Review[]; // v2.2 — 시드 없음
  promo: Promo; // v2.6 입장 팝업 설정 (단일 레코드). 기본 DEFAULT_PROMO(enabled:false)
}

/**
 * 나주배 상세 본문 — 빈 줄로 문단 구분. 확인되지 않은 구체 사실(수상, N대째 등) 없음.
 * BRAND v2 카피 톤: 감성 서사 없이 산지·프로세스·규격·식감·보관법 중심.
 * supabase/schema.sql 시드와 반드시 동일하게 유지할 것.
 */
const NAJU_PEAR_DETAIL = [
  '나주는 일조량이 풍부하고 일교차가 큰 배 재배 적지입니다. 이곳에서 자란 배는 과육이 아삭하고 과즙이 많으며, 시원하고 깔끔한 단맛이 특징입니다.',
  '임과일은 전남 나주에서 과수원을 직접 운영하며 신고배와 풍수배 품종을 재배합니다. 재배부터 수확, 선별, 포장까지 전 과정을 농장에서 관리하고, 주문 확인 후 산지에서 바로 발송합니다. 중간 유통 단계가 없어 수확 후 도착까지 걸리는 시간이 짧습니다.',
  '구성은 선물세트 7.5kg·15kg, 가정용 7.5kg·15kg 중에서 선택할 수 있습니다. 과수 규격은 각 옵션에 표기되어 있으며, 모든 가격은 배송비 포함가입니다.',
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
    "type": "heading",
    "label": "임과일 나주배",
    "title": "나주에서 수확한 그대로."
  },
  {
    "body": "재배부터 수확, 선별, 포장까지 전남 나주 과수원에서 직접 하고, 주문 확인 후 산지에서 바로 발송합니다.",
    "type": "text"
  },
  {
    "url": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/hero.jpg",
    "type": "image",
    "caption": "수확한 나주배"
  },
  {
    "body": "농림축산식품부 우수관리인증 제 1006050호",
    "type": "badge",
    "title": "GAP 우수관리인증"
  },
  {
    "body": "광주남구점 · 나주혁신점 · 산포농협 · 북광주농협",
    "type": "badge",
    "title": "농협 로컬푸드 직매장 입점"
  },
  {
    "type": "heading",
    "label": "품종",
    "title": "세 가지 배를 재배합니다."
  },
  {
    "body": "과실이 크고 과육이 부드럽습니다. 신맛이 적고 저장성이 좋아 오래 두고 먹기 좋습니다.",
    "type": "badge",
    "title": "신고배 · 가장 대중적인 품종"
  },
  {
    "body": "껍질이 얇고 석세포가 적어 식감이 아삭하고 당도가 우수합니다. 수령 후에는 냉장 보관을 권장합니다.",
    "type": "badge",
    "title": "풍수배 · 아삭한 식감"
  },
  {
    "body": "배향이 진하고 감미가 높습니다. 표면이 노란빛을 띠고 과즙이 풍부합니다.",
    "type": "badge",
    "title": "황금배 · 진한 향과 높은 감미"
  },
  {
    "type": "image",
    "url": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/cut.jpg",
    "caption": "잘라 보면 과육이 촘촘한 나주배"
  },
  {
    "type": "heading",
    "label": "유통",
    "title": "유통 단계를 줄였습니다."
  },
  {
    "body": "일반적인 유통은 농장에서 경매장, 도매상, 소매점을 거쳐 가정에 도착합니다. 임과일 나주배는 농장에서 바로 출발해 중간 단계 없이 도착합니다.\n\n중간 단계가 없어 수확 후 도착까지 걸리는 시간이 짧습니다.",
    "type": "text"
  },
  {
    "type": "image",
    "url": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/farm-truck.gif",
    "caption": "수확한 배를 산지에서 바로 실어 보냅니다"
  },
  {
    "type": "heading",
    "label": "출하 과정",
    "title": "주문 확인 후 당일 수확합니다."
  },
  {
    "body": "주문을 확인한 뒤 잘 익은 배만 골라 당일 수확합니다.",
    "type": "point",
    "title": "수확",
    "imageUrl": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/step-harvest.jpg"
  },
  {
    "body": "전자식 선별기로 크기와 무게를 확인해 1차 선별합니다.",
    "type": "point",
    "title": "선별",
    "imageUrl": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/step-sorting.jpg"
  },
  {
    "body": "육안으로 2차 검수한 뒤 하나하나 완충 포장합니다.",
    "type": "point",
    "title": "검수와 포장",
    "imageUrl": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/step-packing.jpg"
  },
  {
    "type": "heading",
    "label": "직접 재배",
    "title": "재배부터 포장까지 직접 합니다."
  },
  {
    "body": "임과일은 전남 나주에서 과수원을 직접 운영합니다. 재배와 수확, 선별, 포장, 발송까지 전 과정을 농장에서 관리합니다.",
    "type": "text"
  },
  {
    "url": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/blossom.jpg",
    "type": "image",
    "caption": "봄이면 과수원 가득 피는 배꽃"
  },
  {
    "url": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/on-tree.jpg",
    "type": "image",
    "caption": "봉지를 씌워 나무에서 기른 나주배"
  },
  {
    "type": "heading",
    "label": "Information",
    "title": "상품 구성"
  },
  {
    "rows": [
      {
        "k": "선물세트 7.5kg",
        "v": "8~11과 또는 12~13과"
      },
      {
        "k": "선물세트 15kg",
        "v": "20과 내 또는 25과 내"
      },
      {
        "k": "가정용 7.5kg",
        "v": "12과 내"
      },
      {
        "k": "가정용 15kg",
        "v": "24과 내"
      }
    ],
    "type": "specs",
    "title": "배송비 포함가"
  },
  {
    "body": "구성과 크기는 작황에 따라 조금씩 달라질 수 있습니다. 옵션별 가격은 상단 구매하기에서 확인해 주세요.",
    "type": "text"
  },
  {
    "type": "heading",
    "label": "안내",
    "title": "포장·배송 안내"
  },
  {
    "url": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/giftbox.jpg",
    "type": "image",
    "caption": "완충 포장한 선물세트"
  },
  {
    "url": "https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/wrap.jpg",
    "type": "image",
    "caption": "임과일 선물 보자기 포장"
  },
  {
    "body": "배 하나하나 완충재로 감싸 포장합니다.\n\n주문 확인 후 산지에서 바로 발송합니다.\n\n명절 성수기에는 주문 순서대로 순차 발송합니다.",
    "type": "notice",
    "title": "이렇게 보내드립니다"
  },
  {
    "body": "농산물 특성상 크기, 모양, 색이 사진과 다소 다를 수 있습니다.\n\n수령 후에는 냉장 보관을 권장하며, 상온에서는 서늘하고 통풍이 잘 되는 곳에 두세요.",
    "type": "notice",
    "title": "확인해 주세요"
  },
  {
    "type": "heading",
    "label": "생산지",
    "title": "전라남도 나주시"
  },
  {
    "body": "전라남도 나주시 덕룡로 33-8 풍천대봉감농원에서 재배하고 발송합니다.",
    "type": "text"
  },
  {
    "rows": [
      {
        "k": "생산자",
        "v": "임용균 · 풍천대봉감농원"
      },
      {
        "k": "문의",
        "v": "010-2618-5151"
      },
      {
        "k": "카카오톡",
        "v": "limcon1"
      }
    ],
    "type": "specs"
  }
];

/** 황금배 상세 — 품종 일반 특징 + 실제 구성 (작년 추석 가격표 기준) */
const GOLDEN_PEAR_DETAIL = [
  '황금배는 황금빛이 도는 얇은 껍질과 풍부한 과즙이 특징인 품종입니다. 부드러운 단맛이 있어 선물용과 가정용 모두에서 꾸준히 찾는 배입니다.',
  '임과일 과수원에서 재배부터 수확, 선별, 포장까지 직접 진행하고 주문 확인 후 산지에서 바로 발송합니다.',
  '구성은 5kg·7kg·10kg 중에서 선택할 수 있습니다. 과수 규격은 각 옵션에 표기되어 있으며, 모든 가격은 배송비 포함가입니다.',
].join('\n\n');

const GOLDEN_PEAR_BLOCKS: DetailBlock[] = [
  {
    type: 'heading',
    label: '임과일 황금배',
    title: '황금빛 껍질, 풍부한 과즙.',
  },
  {
    type: 'text',
    body: '황금배는 황금빛이 도는 얇은 껍질과 풍부한 과즙이 특징인 품종입니다. 부드러운 단맛이 있어 선물용과 가정용 모두에서 꾸준히 찾는 배입니다.',
  },
  {
    type: 'point',
    title: '산지 직송',
    body: '농장에서 경매장, 도매상, 소매점을 거치는 일반적인 유통 대신 농장에서 택배로 바로 발송합니다. 중간 단계가 없어 수확 후 도착까지 걸리는 시간이 짧습니다.',
  },
  {
    type: 'point',
    title: '재배부터 포장까지 직접',
    body: '재배부터 수확, 선별, 포장까지 전 과정을 농장에서 직접 진행합니다. 주문 확인 후 산지에서 발송합니다.',
  },
  {
    type: 'specs',
    title: '상품 구성 (배송비 포함가)',
    rows: [
      { k: '5kg', v: '7~10과 또는 11~13과' },
      { k: '7kg', v: '10~13과 또는 14~18과' },
      { k: '10kg', v: '20과 내' },
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

/** 도라지배즙 — 봉지 용량·제조 정보는 확인 후 보강 (PLACEHOLDERS.md) */
const PEAR_JUICE_DETAIL = [
  '농장에서 수확한 배에 도라지를 더해 만든 배즙입니다. 낱개 파우치라 하나씩 꺼내 드시기 좋습니다.',
  '구성은 50봉지, 100봉지 중에서 선택할 수 있습니다. 가격은 배송비 포함가입니다.',
].join('\n\n');

const PEAR_JUICE_BLOCKS: DetailBlock[] = [
  {
    type: 'heading',
    label: '임과일 도라지배즙',
    title: '배와 도라지를 그대로 담았습니다.',
  },
  {
    type: 'text',
    body: '농장에서 수확한 배에 도라지를 더해 만든 배즙입니다. 낱개 파우치라 하나씩 꺼내 드시기 좋습니다.',
  },
  {
    type: 'specs',
    title: '상품 구성 (배송비 포함가)',
    rows: [
      { k: '50봉지', v: '낱개 파우치' },
      { k: '100봉지', v: '낱개 파우치' },
    ],
  },
  {
    type: 'heading',
    label: '생산지',
    title: '전라남도 나주시',
  },
  {
    type: 'text',
    body: '전라남도 나주시 덕룡로 33-8 (풍천대봉감농원)의 배로 만들었습니다.',
  },
];

/**
 * 시드 상품 3개 — 사용자의 작년 추석 가격표 기준 실제 카탈로그.
 * 가격은 작년(2025 추석) 기준이므로 시즌마다 관리자에서 갱신.
 */
function seedProducts(): Product[] {
  return [
    {
      id: 'naju-pear',
      name: '나주배',
      subtitle: '신고·풍수 품종, 산지에서 바로 보내드립니다',
      imageUrl:
        'https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/hero.jpg',
      detail: NAJU_PEAR_DETAIL,
      blocks: NAJU_PEAR_BLOCKS,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'golden-pear',
      name: '황금배',
      subtitle: '황금빛 껍질에 과즙이 풍부한 황금배',
      imageUrl: null,
      detail: GOLDEN_PEAR_DETAIL,
      blocks: GOLDEN_PEAR_BLOCKS,
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 'pear-juice',
      name: '도라지배즙',
      subtitle: '농장 배에 도라지를 더해 만든 배즙',
      imageUrl: null,
      detail: PEAR_JUICE_DETAIL,
      blocks: PEAR_JUICE_BLOCKS,
      isActive: true,
      sortOrder: 3,
    },
  ];
}

/**
 * 시드 옵션 13개 — 작년 추석 가격표 그대로 (배송비 포함가).
 * 가격은 시즌마다 관리자 /admin/products 에서 갱신.
 */
function seedOptions(): ProductOption[] {
  return [
    // 나주배 (신고·풍수)
    {
      id: 'np-gift-7-5-l',
      productId: 'naju-pear',
      name: '선물세트 7.5kg (8~11과)',
      description: '대과 위주 · 명절 선물용',
      price: 48000,
      soldOut: false,
      sortOrder: 1,
    },
    {
      id: 'np-gift-7-5-m',
      productId: 'naju-pear',
      name: '선물세트 7.5kg (12~13과)',
      description: '중과 · 명절 선물용',
      price: 38000,
      soldOut: false,
      sortOrder: 2,
    },
    {
      id: 'np-gift-15-l',
      productId: 'naju-pear',
      name: '선물세트 15kg (20과 내)',
      description: '대과 위주 · 대용량',
      price: 80000,
      soldOut: false,
      sortOrder: 3,
    },
    {
      id: 'np-gift-15-m',
      productId: 'naju-pear',
      name: '선물세트 15kg (25과 내)',
      description: '중과 · 대용량',
      price: 68000,
      soldOut: false,
      sortOrder: 4,
    },
    {
      id: 'np-home-7-5',
      productId: 'naju-pear',
      name: '가정용 7.5kg (12과 내)',
      description: '실속 가정용',
      price: 29000,
      soldOut: false,
      sortOrder: 5,
    },
    {
      id: 'np-home-15',
      productId: 'naju-pear',
      name: '가정용 15kg (24과 내)',
      description: '넉넉한 가정용',
      price: 48000,
      soldOut: false,
      sortOrder: 6,
    },
    // 황금배
    {
      id: 'gp-5-l',
      productId: 'golden-pear',
      name: '5kg (7~10과)',
      description: '대과 위주',
      price: 37000,
      soldOut: false,
      sortOrder: 1,
    },
    {
      id: 'gp-5-m',
      productId: 'golden-pear',
      name: '5kg (11~13과)',
      description: '중과',
      price: 30000,
      soldOut: false,
      sortOrder: 2,
    },
    {
      id: 'gp-7-l',
      productId: 'golden-pear',
      name: '7kg (10~13과)',
      description: '대과 위주',
      price: 50000,
      soldOut: false,
      sortOrder: 3,
    },
    {
      id: 'gp-7-m',
      productId: 'golden-pear',
      name: '7kg (14~18과)',
      description: '중과',
      price: 40000,
      soldOut: false,
      sortOrder: 4,
    },
    {
      id: 'gp-10',
      productId: 'golden-pear',
      name: '10kg (20과 내)',
      description: '대과 위주 · 대용량',
      price: 80000,
      soldOut: false,
      sortOrder: 5,
    },
    // 도라지배즙
    {
      id: 'pj-50',
      productId: 'pear-juice',
      name: '50봉지',
      description: '낱개 파우치',
      price: 30000,
      soldOut: false,
      sortOrder: 1,
    },
    {
      id: 'pj-100',
      productId: 'pear-juice',
      name: '100봉지',
      description: '낱개 파우치',
      price: 50000,
      soldOut: false,
      sortOrder: 2,
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
    kind: 'SINGLE',
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
        optionId: 'np-gift-7-5-m',
        optionName: '선물세트 7.5kg (12~13과)',
        unitPrice: 38000,
        quantity: 1,
      },
    ],
    totalAmount: 38000,
    marketingConsent: false,
    shipments: [],
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
    kind: 'SINGLE',
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
        optionId: 'np-home-7-5',
        optionName: '가정용 7.5kg (12과 내)',
        unitPrice: 29000,
        quantity: 2,
      },
    ],
    totalAmount: 58000,
    marketingConsent: false,
    shipments: [],
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
 * v2.4: Order.kind/shipments 추가 — kind/shipments 없는 구 주문 객체가 남아 있으면
 * 렌더/발송 처리에서 죽으므로 키를 올려(V2_2 → V2_4) 새로 시드한다.
 */
function getData(): MemoryData {
  const g = globalThis as typeof globalThis & {
    __limfruitsMemoryDbV2_4?: MemoryData;
  };
  if (!g.__limfruitsMemoryDbV2_4) {
    g.__limfruitsMemoryDbV2_4 = {
      products: seedProducts(),
      options: seedOptions(),
      orders: seedOrders(),
      reviews: [],
      promo: { ...DEFAULT_PROMO },
    };
  }
  // v2.6: promo 는 신규 필드 — 싱글턴 키를 올리지 않으므로, 이전 세션(dev HMR)에서
  // 만들어진 데이터에 promo 가 없으면 기본값으로 병합한다.
  if (!g.__limfruitsMemoryDbV2_4.promo) {
    g.__limfruitsMemoryDbV2_4.promo = { ...DEFAULT_PROMO };
  }
  return g.__limfruitsMemoryDbV2_4;
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
    marketingConsent?: boolean;
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
      kind: 'SINGLE',
      customerName: input.customerName,
      phone: normalizePhone(input.phone),
      postcode: input.postcode,
      address1: input.address1,
      address2: input.address2,
      memo: input.memo,
      items: clone(input.items),
      shipments: [],
      totalAmount: input.totalAmount,
      marketingConsent: input.marketingConsent ?? false,
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
  }): Promise<Order> {
    const data = getData();
    let orderNo = generateOrderNo();
    while (data.orders.some((o) => o.orderNo === orderNo)) {
      orderNo = generateOrderNo();
    }

    // 배송 건 id 는 이 주문의 shipments 안에서만 유일하면 됨
    const shipments: Shipment[] = [];
    for (const s of input.shipments) {
      shipments.push({
        id: uniqueShortId(shipments),
        recipientName: s.recipientName,
        phone: normalizePhone(s.phone),
        postcode: s.postcode,
        address1: s.address1,
        address2: s.address2,
        giftMessage: s.giftMessage,
        items: clone(s.items),
        courier: null,
        trackingNo: null,
      });
    }

    const order: Order = {
      id: randomUUID(),
      orderNo,
      status: 'PENDING',
      kind: 'GIFT',
      // GIFT: top-level 이름/연락처 = 보내는 분(주문자), 주소는 빈 문자열
      customerName: input.senderName,
      phone: normalizePhone(input.senderPhone),
      postcode: '',
      address1: '',
      address2: '',
      memo: input.memo,
      // 총액 계산·하위호환용: 모든 배송 건 items 를 평탄화한 합
      items: shipments.flatMap((s) => clone(s.items)),
      shipments,
      totalAmount: input.totalAmount,
      marketingConsent: input.marketingConsent ?? false,
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

  async updateShipment(
    orderNo: string,
    shipmentId: string,
    patch: { courier?: string | null; trackingNo?: string | null }
  ): Promise<void> {
    const order = getData().orders.find((o) => o.orderNo === orderNo);
    if (!order) {
      throw new Error(`주문을 찾을 수 없습니다: ${orderNo}`);
    }
    const shipment = order.shipments.find((s) => s.id === shipmentId);
    if (!shipment) {
      throw new Error(`배송 건을 찾을 수 없습니다: ${orderNo} / ${shipmentId}`);
    }
    if (patch.courier !== undefined) shipment.courier = patch.courier;
    if (patch.trackingNo !== undefined) shipment.trackingNo = patch.trackingNo;
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
    const data = getData();
    if (data.reviews.some((r) => r.orderNo === input.orderNo)) {
      // Supabase unique(order_no) 위반과 동일하게 구분 가능한 에러로
      throw new ReviewExistsError(input.orderNo);
    }
    const review: Review = {
      id: randomUUID(),
      productId: input.productId,
      orderNo: input.orderNo,
      authorName: input.authorName,
      phone: normalizePhone(input.phone),
      rating: input.rating,
      body: input.body,
      photos: [...input.photos],
      status: 'VISIBLE',
      createdAt: new Date().toISOString(),
    };
    data.reviews.push(review);
    return clone(review);
  }

  async getReviewByOrderNo(orderNo: string): Promise<Review | null> {
    const review = getData().reviews.find((r) => r.orderNo === orderNo);
    return review ? clone(review) : null;
  }

  async listReviews(params?: {
    productId?: string;
    includeHidden?: boolean;
    limit?: number;
  }): Promise<Review[]> {
    let reviews = [...getData().reviews];
    if (params?.productId !== undefined) {
      reviews = reviews.filter((r) => r.productId === params.productId);
    }
    if (!params?.includeHidden) {
      reviews = reviews.filter((r) => r.status === 'VISIBLE');
    }
    reviews.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (params?.limit !== undefined) {
      reviews = reviews.slice(0, params.limit);
    }
    return clone(reviews);
  }

  async setReviewStatus(id: string, status: ReviewStatus): Promise<void> {
    const review = getData().reviews.find((r) => r.id === id);
    if (!review) {
      throw new Error(`리뷰를 찾을 수 없습니다: ${id}`);
    }
    review.status = status;
  }

  /** 없는 id면 조용히 무시(멱등 — Supabase delete와 동일 동작) */
  async deleteReview(id: string): Promise<void> {
    const data = getData();
    data.reviews = data.reviews.filter((r) => r.id !== id);
  }

  // ── 입장 팝업 (v2.6) ──────────────────────────────────

  async getPromo(): Promise<Promo> {
    return clone(getData().promo);
  }

  async updatePromo(patch: Partial<Promo>): Promise<void> {
    const data = getData();
    const promo = data.promo;
    if (patch.enabled !== undefined) promo.enabled = patch.enabled;
    if (patch.title !== undefined) promo.title = patch.title;
    if (patch.body !== undefined) promo.body = patch.body;
    if (patch.shipStart !== undefined) promo.shipStart = patch.shipStart;
    if (patch.shipEnd !== undefined) promo.shipEnd = patch.shipEnd;
    if (patch.reserveDeadline !== undefined)
      promo.reserveDeadline = patch.reserveDeadline;
    if (patch.ctaLabel !== undefined) promo.ctaLabel = patch.ctaLabel;
    if (patch.ctaHref !== undefined) promo.ctaHref = patch.ctaHref;
  }
}

let memoryStore: MemoryStore | null = null;

export function getMemoryStore(): Store {
  if (!memoryStore) {
    memoryStore = new MemoryStore();
  }
  return memoryStore;
}
