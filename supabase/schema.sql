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
  customer_name text not null,
  phone text not null,            -- 숫자만 저장 (01012345678)
  postcode text not null default '',
  address1 text not null,
  address2 text not null default '',
  memo text not null default '',
  items jsonb not null,           -- OrderItem[] 스냅샷 (productId/productName/optionId/optionName/unitPrice/quantity)
  total_amount integer not null check (total_amount >= 0),
  payment_key text,
  payment_method text,
  paid_at timestamptz,
  courier text,
  tracking_no text,
  created_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

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
    null,
    '나주는 일조량이 풍부하고 일교차가 큰 배 재배 적지입니다. 이곳에서 자란 배는 과육이 아삭하고 과즙이 많으며, 시원하고 깔끔한 단맛이 특징입니다.

임과일은 전남 나주에서 과수원을 직접 운영하며 신고배와 풍수배 품종을 재배합니다. 재배부터 수확, 선별, 포장까지 전 과정을 농장에서 관리하고, 주문 확인 후 산지에서 바로 발송합니다. 중간 유통 단계가 없어 수확 후 도착까지 걸리는 시간이 짧습니다.

구성은 선물세트 7.5kg·15kg, 가정용 7.5kg·15kg 중에서 선택할 수 있습니다. 과수 규격은 각 옵션에 표기되어 있으며, 모든 가격은 배송비 포함가입니다.

받으신 배는 한 개씩 종이에 싸서 냉장 보관하면 오래 신선하게 유지됩니다. 상온에 둘 경우 서늘하고 통풍이 잘 되는 곳에 보관해 주세요.',
    '[
      {"type": "heading", "label": "임과일 나주배", "title": "나주에서 수확한 그대로."},
      {"type": "text", "body": "나주는 일조량이 풍부하고 토질이 배 재배에 알맞아 오래전부터 배 산지로 알려진 곳입니다.\n\n임과일은 신고배와 풍수배 품종을 재배합니다. 과육이 아삭하고 과즙이 풍부하며, 시원하고 깔끔한 단맛이 특징입니다."},
      {"type": "point", "title": "산지 직송", "body": "농장에서 경매장, 도매상, 소매점을 거치는 일반적인 유통 대신 농장에서 택배로 바로 발송합니다. 중간 단계가 없어 수확 후 도착까지 걸리는 시간이 짧습니다."},
      {"type": "point", "title": "당도 관리", "body": "당도가 충분히 오른 시기를 확인한 뒤 수확해 발송합니다. 기준 당도는 OO brix 이상입니다."},
      {"type": "point", "title": "재배부터 포장까지 직접", "body": "재배부터 수확, 선별, 포장까지 전 과정을 농장에서 직접 진행합니다. 주문 확인 후 산지에서 발송합니다."},
      {"type": "specs", "title": "상품 구성 (배송비 포함가)", "rows": [
        {"k": "선물세트 7.5kg", "v": "8~11과 또는 12~13과"},
        {"k": "선물세트 15kg", "v": "20과 내 또는 25과 내"},
        {"k": "가정용 7.5kg", "v": "12과 내"},
        {"k": "가정용 15kg", "v": "24과 내"}
      ]},
      {"type": "notice", "title": "포장·배송 안내", "body": "배 하나하나 완충재로 감싸 배송 중 충격을 줄입니다. 수확 후 신속히 발송하며, 농산물 특성상 크기와 모양은 사진과 다소 다를 수 있습니다."},
      {"type": "heading", "label": "생산지", "title": "전라남도 나주시"},
      {"type": "text", "body": "전라남도 나주시 덕룡로 33-8 (풍천대봉감농원)에서 재배하고 발송합니다."}
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
