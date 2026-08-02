-- 임과일 (limfruits) Supabase 스키마
-- Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 실행하세요.
-- 서비스 롤 키로만 접근합니다 (RLS enable + 정책 없음 = anon 접근 차단).

-- 상품 옵션
create table if not exists public.product_options (
  id text primary key,
  name text not null,
  description text not null default '',
  price integer not null check (price >= 0),
  sold_out boolean not null default false,
  sort_order integer not null default 0
);

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
  items jsonb not null,           -- OrderItem[] 스냅샷
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
alter table public.product_options enable row level security;
alter table public.orders enable row level security;

-- 시드: 옵션 4개 (가격은 placeholder — 실제 가격으로 수정 필요, PLACEHOLDERS.md 참고)
insert into public.product_options (id, name, description, price, sold_out, sort_order) values
  ('home-3kg',   '나주배 가정용 3kg',     '5~7과 · 실속 가정용',           19000, false, 1),
  ('home-5kg',   '나주배 가정용 5kg',     '9~11과 · 온 가족 넉넉하게',      27000, false, 2),
  ('gift-5kg',   '나주배 선물세트 5kg',   '7~9과 · 명절 선물용',           35000, false, 3),
  ('gift-7-5kg', '나주배 선물세트 7.5kg', '9~12과 · 감사한 분께 넉넉하게', 45000, false, 4)
on conflict (id) do nothing;
