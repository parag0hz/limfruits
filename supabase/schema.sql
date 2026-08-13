-- 임과일 (limfruits) Supabase 스키마 v2 — 다중 상품 카탈로그
-- 신규 설치 기준. Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 실행하세요.
-- 서비스 롤 키로만 접근합니다 (RLS enable + 정책 없음 = anon 접근 차단).

-- 상품
create table if not exists public.products (
  id text primary key,              -- 'naju-pear' 같은 슬러그 또는 랜덤 id
  name text not null,
  subtitle text not null default '',
  image_url text,                   -- null이면 앱에서 브랜드 일러스트 placeholder 렌더
  detail text not null default '',  -- (구) 단순 본문. blocks 비어 있을 때의 폴백
  blocks jsonb not null default '[]', -- v2.1 카드뉴스형 상세 블록 (DetailBlock[])
  is_active boolean not null default true,
  sort_order integer not null default 0
);

-- 상품 옵션 (상품 삭제 시 소속 옵션도 함께 삭제)
create table if not exists public.product_options (
  id text primary key,
  product_id text not null references public.products (id) on delete cascade,
  name text not null,               -- "가정용 3kg" (상품에 소속되므로 상품명 접두 없음)
  description text not null default '',
  price integer not null check (price > 0), -- SPEC: price 양의 정수 (API 검증과 동일)
  sold_out boolean not null default false,
  sort_order integer not null default 0
);

create index if not exists product_options_product_id_idx
  on public.product_options (product_id);

-- 주문
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'SHIPPING', 'DONE', 'CANCELED')),
  kind text not null default 'SINGLE'   -- v2.4 SINGLE(단일 주문) | GIFT(선물·다중 배송지)
    check (kind in ('SINGLE', 'GIFT')),
  customer_name text not null,    -- SINGLE=받는 분 / GIFT=보내는 분(주문자)
  phone text not null,            -- 숫자만 저장 (01012345678)
  postcode text not null default '',
  address1 text not null,         -- GIFT는 빈 문자열 (배송지는 shipments 안에)
  address2 text not null default '',
  memo text not null default '',
  items jsonb not null,           -- OrderItem[] 스냅샷 (GIFT는 모든 배송 건 items 평탄화 합)
  shipments jsonb not null default '[]', -- v2.4 GIFT 배송 건 배열 (Shipment[]). SINGLE은 []
  total_amount integer not null check (total_amount >= 0),
  marketing_consent boolean not null default false, -- v2.7 광고성(문자) 수신 동의. GIFT는 보내는 분 동의
  user_id text,                   -- v2.8 로그인(카카오) 주문이면 users.id. 비회원·기존 주문은 null
  payment_key text,
  payment_method text,
  paid_at timestamptz,
  courier text,
  tracking_no text,
  created_at timestamptz not null default now()
);

-- v2.4 멱등 마이그레이션 — 기존 설치 사용자는 이 두 문장만 다시 실행해도 안전합니다.
-- (신규 설치는 위 create table 이 이미 두 컬럼을 포함)
alter table public.orders
  add column if not exists kind text not null default 'SINGLE';
alter table public.orders
  add column if not exists shipments jsonb not null default '[]';

-- v2.7 멱등 마이그레이션 — 기존 설치 사용자는 이 문장만 다시 실행해도 안전합니다.
-- (신규 설치는 위 create table 이 이미 이 컬럼을 포함)
alter table public.orders
  add column if not exists marketing_consent boolean not null default false;

-- v2.8 멱등 마이그레이션 — 기존 설치 사용자는 이 문장만 다시 실행해도 안전합니다.
-- (신규 설치는 위 create table 이 이미 이 컬럼을 포함)
alter table public.orders
  add column if not exists user_id text;

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_user_id_idx on public.orders (user_id);

-- RLS: 켜기만 하고 정책은 만들지 않음 → 서비스 롤 키로만 접근 가능
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.orders enable row level security;

-- 시드: 상품 3개 — 작년(2025) 추석 가격표 기준 실제 카탈로그 (lib/db-memory.ts 시드와 동일하게 유지)
-- 가격은 시즌마다 관리자 /admin/products 에서 갱신. "OO brix"는 확인 후 교체할 placeholder (PLACEHOLDERS.md 참고)
insert into public.products (id, name, subtitle, image_url, detail, blocks, is_active, sort_order) values
  (
    'naju-pear',
    '나주배',
    '신고·풍수 품종, 산지에서 바로 보내드립니다',
    'https://slgqhazobcoesnpgztei.supabase.co/storage/v1/object/public/products/naju-pear/hero.jpg',
    '나주는 일조량이 풍부하고 일교차가 큰 배 재배 적지입니다. 이곳에서 자란 배는 과육이 아삭하고 과즙이 많으며, 시원하고 깔끔한 단맛이 특징입니다.

임과일은 전남 나주에서 과수원을 직접 운영하며 신고배와 풍수배 품종을 재배합니다. 재배부터 수확, 선별, 포장까지 전 과정을 농장에서 관리하고, 주문 확인 후 산지에서 바로 발송합니다. 중간 유통 단계가 없어 수확 후 도착까지 걸리는 시간이 짧습니다.

구성은 선물세트 7.5kg·15kg, 가정용 7.5kg·15kg 중에서 선택할 수 있습니다. 과수 규격은 각 옵션에 표기되어 있으며, 모든 가격은 배송비 포함가입니다.

받으신 배는 한 개씩 종이에 싸서 냉장 보관하면 오래 신선하게 유지됩니다. 상온에 둘 경우 서늘하고 통풍이 잘 되는 곳에 보관해 주세요.',
    '[
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
]'::jsonb,
    true,
    1
  ),
  (
    'golden-pear',
    '황금배',
    '황금빛 껍질에 과즙이 풍부한 황금배',
    null,
    '황금배는 황금빛이 도는 얇은 껍질과 풍부한 과즙이 특징인 품종입니다. 부드러운 단맛이 있어 선물용과 가정용 모두에서 꾸준히 찾는 배입니다.

임과일 과수원에서 재배부터 수확, 선별, 포장까지 직접 진행하고 주문 확인 후 산지에서 바로 발송합니다.

구성은 5kg·7kg·10kg 중에서 선택할 수 있습니다. 과수 규격은 각 옵션에 표기되어 있으며, 모든 가격은 배송비 포함가입니다.',
    '[
      {"type": "heading", "label": "임과일 황금배", "title": "황금빛 껍질, 풍부한 과즙."},
      {"type": "text", "body": "황금배는 황금빛이 도는 얇은 껍질과 풍부한 과즙이 특징인 품종입니다. 부드러운 단맛이 있어 선물용과 가정용 모두에서 꾸준히 찾는 배입니다."},
      {"type": "point", "title": "산지 직송", "body": "농장에서 경매장, 도매상, 소매점을 거치는 일반적인 유통 대신 농장에서 택배로 바로 발송합니다. 중간 단계가 없어 수확 후 도착까지 걸리는 시간이 짧습니다."},
      {"type": "point", "title": "재배부터 포장까지 직접", "body": "재배부터 수확, 선별, 포장까지 전 과정을 농장에서 직접 진행합니다. 주문 확인 후 산지에서 발송합니다."},
      {"type": "specs", "title": "상품 구성 (배송비 포함가)", "rows": [
        {"k": "5kg", "v": "7~10과 또는 11~13과"},
        {"k": "7kg", "v": "10~13과 또는 14~18과"},
        {"k": "10kg", "v": "20과 내"}
      ]},
      {"type": "notice", "title": "포장·배송 안내", "body": "배 하나하나 완충재로 감싸 배송 중 충격을 줄입니다. 수확 후 신속히 발송하며, 농산물 특성상 크기와 모양은 사진과 다소 다를 수 있습니다."},
      {"type": "heading", "label": "생산지", "title": "전라남도 나주시"},
      {"type": "text", "body": "전라남도 나주시 덕룡로 33-8 (풍천대봉감농원)에서 재배하고 발송합니다."}
    ]'::jsonb,
    true,
    2
  ),
  (
    'pear-juice',
    '도라지배즙',
    '농장 배에 도라지를 더해 만든 배즙',
    null,
    '농장에서 수확한 배에 도라지를 더해 만든 배즙입니다. 낱개 파우치라 하나씩 꺼내 드시기 좋습니다.

구성은 50봉지, 100봉지 중에서 선택할 수 있습니다. 가격은 배송비 포함가입니다.',
    '[
      {"type": "heading", "label": "임과일 도라지배즙", "title": "배와 도라지를 그대로 담았습니다."},
      {"type": "text", "body": "농장에서 수확한 배에 도라지를 더해 만든 배즙입니다. 낱개 파우치라 하나씩 꺼내 드시기 좋습니다."},
      {"type": "specs", "title": "상품 구성 (배송비 포함가)", "rows": [
        {"k": "50봉지", "v": "낱개 파우치"},
        {"k": "100봉지", "v": "낱개 파우치"}
      ]},
      {"type": "heading", "label": "생산지", "title": "전라남도 나주시"},
      {"type": "text", "body": "전라남도 나주시 덕룡로 33-8 (풍천대봉감농원)의 배로 만들었습니다."}
    ]'::jsonb,
    true,
    3
  )
on conflict (id) do nothing;

-- 시드: 옵션 13개 — 작년 추석 가격표 그대로 (배송비 포함가). 시즌마다 관리자에서 갱신
insert into public.product_options (id, product_id, name, description, price, sold_out, sort_order) values
  -- 나주배 (신고·풍수)
  ('np-gift-7-5-l', 'naju-pear',   '선물세트 7.5kg (8~11과)',  '대과 위주 · 명절 선물용', 48000, false, 1),
  ('np-gift-7-5-m', 'naju-pear',   '선물세트 7.5kg (12~13과)', '중과 · 명절 선물용',      38000, false, 2),
  ('np-gift-15-l',  'naju-pear',   '선물세트 15kg (20과 내)',  '대과 위주 · 대용량',      80000, false, 3),
  ('np-gift-15-m',  'naju-pear',   '선물세트 15kg (25과 내)',  '중과 · 대용량',           68000, false, 4),
  ('np-home-7-5',   'naju-pear',   '가정용 7.5kg (12과 내)',   '실속 가정용',             29000, false, 5),
  ('np-home-15',    'naju-pear',   '가정용 15kg (24과 내)',    '넉넉한 가정용',           48000, false, 6),
  -- 황금배
  ('gp-5-l',  'golden-pear', '5kg (7~10과)',   '대과 위주',           37000, false, 1),
  ('gp-5-m',  'golden-pear', '5kg (11~13과)',  '중과',                30000, false, 2),
  ('gp-7-l',  'golden-pear', '7kg (10~13과)',  '대과 위주',           50000, false, 3),
  ('gp-7-m',  'golden-pear', '7kg (14~18과)',  '중과',                40000, false, 4),
  ('gp-10',   'golden-pear', '10kg (20과 내)', '대과 위주 · 대용량',  80000, false, 5),
  -- 도라지배즙
  ('pj-50',  'pear-juice', '50봉지',  '낱개 파우치', 30000, false, 1),
  ('pj-100', 'pear-juice', '100봉지', '낱개 파우치', 50000, false, 2)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- v2.2 리뷰 — 구매자 포토 리뷰 (주문당 1개). 시드 없음.
-- 기존 설치 사용자는 이 절만 다시 실행해도 안전합니다 (모든 문장 멱등).

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,       -- products.id 참조 (FK 없음 — 상품 삭제 후에도 리뷰 유지)
  order_no text not null unique,  -- 주문당 리뷰 1개
  author_name text not null,      -- 주문자명 원본. 화면 표시는 앱에서 마스킹(김*원)
  phone text not null,            -- 숫자만. 검증용 — API 응답·화면 노출 금지
  rating integer not null check (rating between 1 and 5),
  body text not null,             -- 10~2000자 (길이 검증은 API에서)
  photos jsonb not null default '[]',  -- Storage 공개 URL 배열 (최대 3)
  status text not null default 'VISIBLE'
    check (status in ('VISIBLE', 'HIDDEN')),
  created_at timestamptz not null default now()
);

create index if not exists reviews_product_id_idx
  on public.reviews (product_id);
create index if not exists reviews_created_at_idx
  on public.reviews (created_at desc);

-- RLS: 켜기만 하고 정책 없음 → 서비스 롤 키로만 접근 (반복 실행해도 안전)
alter table public.reviews enable row level security;

-- ─────────────────────────────────────────────────────────
-- v2.6 입장 팝업 (명절 발송 캘린더) — 사이트 설정 저장소.
-- 기존 설치 사용자는 이 절만 다시 실행해도 안전합니다 (모든 문장 멱등).
-- 팝업 설정은 key='promo' 한 행(value jsonb = Promo). 기본값은 코드(DEFAULT_PROMO)에서
-- 병합하므로 시드 INSERT 는 두지 않습니다.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'
);

-- RLS: 켜기만 하고 정책 없음 → 서비스 롤 키로만 접근 (반복 실행해도 안전)
alter table public.site_settings enable row level security;

-- ─────────────────────────────────────────────────────────
-- v2.8 카카오 소셜 로그인 — 회원(유저) 테이블. 관리자 세션과 완전 분리.
-- 기존 설치 사용자는 이 절만 다시 실행해도 안전합니다 (모든 문장 멱등).
-- orders.user_id 컬럼·인덱스는 위의 orders 정의 및 v2.8 멱등 마이그레이션 절 참고.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  kakao_id text unique not null,       -- 카카오 회원번호. 로그인 upsert 키
  nickname text not null default '',
  points integer not null default 0,   -- v2.9 포인트 잔액(현재 사용가능 합계)
  created_at timestamptz not null default now()
);

-- RLS: 켜기만 하고 정책 없음 → 서비스 롤 키로만 접근 (반복 실행해도 안전)
alter table public.users enable row level security;

-- ─────────────────────────────────────────────────────────
-- v2.9 쿠폰·포인트 — 첫 구매 쿠폰 + 포인트 적립/사용.
-- 기존 설치 사용자는 이 절만 다시 실행해도 안전합니다 (모든 문장 멱등).

-- users.points (구 스키마 마이그레이션)
alter table if exists public.users
  add column if not exists points integer not null default 0;

-- 쿠폰 (유저에게 발급)
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default '첫 구매 할인',
  discount_amount integer not null,
  min_order_amount integer not null default 0,
  status text not null default 'ISSUED',        -- ISSUED | USED
  used_order_no text,
  issued_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz
);
create index if not exists coupons_user_id_idx on public.coupons(user_id);
-- 한 유저당 동일 이름 쿠폰 1장만 (첫 구매 쿠폰 중복발급 방지)
create unique index if not exists coupons_user_name_unique
  on public.coupons(user_id, name);

-- 포인트 원장 (적립·사용·환불·소멸 감사 로그)
create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta integer not null,                       -- +적립 / -사용·회수·소멸
  reason text not null,                         -- EARN_PURCHASE|EARN_REVIEW|SPEND|REFUND|REVOKE|EXPIRE
  order_no text,
  created_at timestamptz not null default now(),
  expires_at timestamptz                        -- 적립분 소멸 예정일 (사용/환불은 null)
);
create index if not exists point_tx_user_idx
  on public.point_transactions(user_id, created_at desc);

-- 주문에 쿠폰·포인트 적용 기록
alter table if exists public.orders
  add column if not exists coupon_id uuid,
  add column if not exists coupon_discount integer not null default 0,
  add column if not exists points_used integer not null default 0,
  add column if not exists points_earned integer not null default 0;

-- 포인트 원장 멱등 키: 한 주문당 사유별 1행 (SPEND/EARN_PURCHASE/EARN_REVIEW/REFUND/EXPIRE 각 1회).
-- 적립·환불·회수를 (order_no, reason)로 멱등화 → 이중 지급/이중 환불/재발급 원천 차단.
create unique index if not exists point_tx_order_reason_unique
  on public.point_transactions (order_no, reason)
  where order_no is not null;

-- RLS: 켜기만 하고 정책 없음 → 서비스 롤 키로만 접근 (반복 실행해도 안전)
alter table public.coupons enable row level security;
alter table public.point_transactions enable row level security;

-- ── 원자적 포인트 함수 (잔액 증감 + 원장 1행을 한 트랜잭션으로) ──────────
-- users.points 와 원장 합의 불일치·경쟁상태(lost update)를 원천 제거한다.

-- 적립/환불/회수 공용: (order_no, reason)이 이미 있으면 멱등 skip. 잔액은 음수 허용(정확한 회수·네팅).
create or replace function public.adjust_points(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_order_no text,
  p_expires_at timestamptz
) returns integer
language plpgsql
as $$
declare
  v_balance integer;
begin
  insert into public.point_transactions (user_id, delta, reason, order_no, expires_at)
  values (p_user_id, p_delta, p_reason, p_order_no, p_expires_at)
  on conflict (order_no, reason) where order_no is not null do nothing;
  if not found then
    return null; -- 이미 같은 (주문, 사유) 기록 존재 → 멱등 skip
  end if;
  update public.users set points = points + p_delta
  where id = p_user_id
  returning points into v_balance;
  return v_balance;
end;
$$;

-- 사용(차감): 잔액 부족 시 원장을 남기지 않고 null 반환(실패). 이미 SPEND 있으면 멱등.
create or replace function public.spend_points(
  p_user_id uuid,
  p_amount integer,
  p_order_no text
) returns integer
language plpgsql
as $$
declare
  v_balance integer;
begin
  insert into public.point_transactions (user_id, delta, reason, order_no, expires_at)
  values (p_user_id, -p_amount, 'SPEND', p_order_no, null)
  on conflict (order_no, reason) where order_no is not null do nothing;
  if not found then
    select points into v_balance from public.users where id = p_user_id;
    return v_balance; -- 이미 이 주문의 SPEND 존재 → 멱등(현재 잔액 반환)
  end if;
  update public.users set points = points - p_amount
  where id = p_user_id and points >= p_amount
  returning points into v_balance;
  if not found then
    -- 잔액 부족(또는 유저 없음) → 방금 넣은 SPEND 원장 롤백 후 실패 신호
    delete from public.point_transactions
    where order_no = p_order_no and reason = 'SPEND';
    return null;
  end if;
  return v_balance;
end;
$$;
