# 임과일 (limfruits) 아키텍처 명세

나주배 직판 쇼핑몰. 단일 상품(나주배) + 중량/포장 옵션, 토스페이먼츠 결제, 관리자 페이지.
이 문서는 모든 구현 에이전트의 **계약서**다. 여기 정의된 인터페이스/경로/이름을 임의로 바꾸지 말 것.

## 스택

- Next.js 15 App Router + TypeScript + Tailwind v4 (스캐폴드 완료)
- 결제: `@tosspayments/tosspayments-sdk` (v2 결제위젯) — 설치됨
- DB: Supabase (`@supabase/supabase-js`) — 설치됨. **환경변수 없으면 인메모리 데모 모드로 자동 폴백**
- 관리자 세션: `jose` JWT + httpOnly 쿠키 — 설치됨
- 주소검색: 다음(카카오) 우편번호 서비스 스크립트 임베드
- 외부 UI 라이브러리 금지. Tailwind만 사용. UI 텍스트는 전부 한국어.

## 라우트 맵

| 경로 | 설명 |
|---|---|
| `/` | 홈: 히어로, 농장 소개, 상품 옵션 카드(→ `/order?option=<id>`), 배송/교환 안내, 푸터 |
| `/order` | 주문: 옵션·수량 선택, 주문자/배송지 폼(다음 주소검색), 토스 결제위젯, 결제 |
| `/order/success` | 토스 리다이렉트 수신 → 서버에서 결제 승인(confirm) → `/order/complete/[orderNo]`로 redirect |
| `/order/fail` | 결제 실패 안내 (`?message=&code=`) |
| `/order/complete/[orderNo]` | 주문 완료 안내 (주문번호, 입금/배송 안내) |
| `/order/lookup` | 비회원 주문조회: 주문번호 + 전화번호 |
| `/admin/login` | 관리자 로그인 (비밀번호 1개) |
| `/admin` | 주문 목록: 상태 필터 탭, 신규(PAID) 강조, 모바일 최적화 |
| `/admin/orders/[orderNo]` | 주문 상세: 상태 변경, 운송장 입력, 결제취소 |
| `/admin/products` | 옵션 관리: 가격 수정, 품절 토글, 이름/설명 수정 |

### API

| 메서드/경로 | 설명 |
|---|---|
| `POST /api/orders` | 주문 생성. body: `{ optionId, quantity, customerName, phone, postcode, address1, address2, memo }` → `{ orderNo, amount, orderName }`. 금액은 **서버가 DB 옵션 가격으로 계산** (클라이언트 금액 신뢰 금지) |
| `GET /api/orders/lookup?orderNo=&phone=` | 주문 조회 (전화번호 일치해야 반환) |
| `POST /api/admin/login` | `{ password }` → 세션 쿠키 발급 |
| `POST /api/admin/logout` | 쿠키 삭제 |
| `PATCH /api/admin/orders/[orderNo]` | `{ status?, courier?, trackingNo? }`. `CANCELED`로 변경 시 paymentKey 있으면 토스 결제취소 API 호출 |
| `PATCH /api/admin/options/[id]` | `{ name?, description?, price?, soldOut?, sortOrder? }` |

admin API/페이지는 세션 쿠키 필수 (`middleware.ts`로 가드, `/admin/login`만 예외).

## 데이터 모델 — `lib/types.ts` (foundation 소유)

```ts
export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPING' | 'DONE' | 'CANCELED';
// PENDING 결제대기 / PAID 결제완료(신규주문) / SHIPPING 배송중 / DONE 배송완료 / CANCELED 취소

export interface ProductOption {
  id: string;
  name: string;         // 예: "나주배 선물세트 5kg"
  description: string;  // 예: "7~9과 · 명절 선물용"
  price: number;        // 원 단위 정수, 배송비 포함가
  soldOut: boolean;
  sortOrder: number;
}

export interface OrderItem {
  optionId: string;
  optionName: string;   // 주문 시점 스냅샷
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNo: string;      // "LF-YYYYMMDD-XXXX" (대문자 영숫자 4자리 랜덤)
  status: OrderStatus;
  customerName: string;
  phone: string;        // 숫자만 저장 (01012345678)
  postcode: string;
  address1: string;
  address2: string;
  memo: string;
  items: OrderItem[];
  totalAmount: number;
  paymentKey: string | null;
  paymentMethod: string | null; // 토스 응답 method (카드/간편결제 등)
  paidAt: string | null;        // ISO
  courier: string | null;       // 택배사명
  trackingNo: string | null;
  createdAt: string;            // ISO
}
```

## 저장소 추상화 — `lib/db.ts` (foundation 소유)

```ts
export interface Store {
  listOptions(): Promise<ProductOption[]>;              // sortOrder 순, 품절 포함
  getOption(id: string): Promise<ProductOption | null>;
  updateOption(id: string, patch: Partial<Omit<ProductOption, 'id'>>): Promise<void>;
  createOrder(input: {
    items: OrderItem[]; totalAmount: number;
    customerName: string; phone: string;
    postcode: string; address1: string; address2: string; memo: string;
  }): Promise<Order>;                                    // orderNo 생성 포함, status PENDING
  getOrderByNo(orderNo: string): Promise<Order | null>;
  findOrder(orderNo: string, phone: string): Promise<Order | null>; // phone 숫자만 비교
  listOrders(params?: { status?: OrderStatus; limit?: number }): Promise<Order[]>; // 최신순
  markPaid(orderNo: string, p: { paymentKey: string; method: string }): Promise<void>;
  updateOrder(orderNo: string, patch: { status?: OrderStatus; courier?: string | null; trackingNo?: string | null }): Promise<void>;
}
export function getStore(): Store; // SUPABASE_URL 있으면 SupabaseStore, 없으면 MemoryStore(데모)
```

- `lib/db-supabase.ts`: 서비스 롤 키로 서버 전용 접근. 테이블 `product_options`, `orders`(items는 jsonb). RLS enable + 정책 없음(서비스 롤만 접근).
- `lib/db-memory.ts`: `globalThis` 싱글턴(HMR 생존). 시드: 옵션 4개 + 예시 주문 2개(이름에 "(예시)" 표기).
  - 시드 옵션: 가정용 3kg 19,000 / 가정용 5kg 27,000 / 선물세트 5kg 35,000 / 선물세트 7.5kg 45,000 — 가격은 placeholder
- `supabase/schema.sql`: 테이블 + RLS + 시드 INSERT. 사용자가 Supabase SQL Editor에 붙여넣는 용도.

## 결제 플로우 (토스 결제위젯 v2)

1. `/order` (client component): 옵션·수량 선택 → 합계 표시 → 위젯 렌더(`widgets.setAmount`, `renderPaymentMethods`, `renderAgreement`) → 폼 검증 → `POST /api/orders`로 PENDING 주문 생성 → 응답의 `orderNo`로 `widgets.requestPayment({ orderId: orderNo, orderName, successUrl: origin + '/order/success', failUrl: origin + '/order/fail', customerName, customerMobilePhone })`
2. `/order/success` (server component): `paymentKey, orderId, amount` 수신 →
   - 주문 조회, `totalAmount === Number(amount)` 검증 (불일치 시 승인하지 않고 fail로)
   - 이미 PAID면 바로 complete로 redirect (새로고침 멱등성)
   - 토스 `POST https://api.tosspayments.com/v1/payments/confirm` (Basic auth: `base64(secretKey + ':')`, body는 **DB의 totalAmount** 사용) → 성공 시 `markPaid` → complete로 redirect
3. 취소/환불: 관리자가 CANCELED로 변경 시 `POST /v1/payments/{paymentKey}/cancel` (`{ cancelReason }`)
4. 토스 API 호출은 `lib/toss.ts`에 모음 (checkout 에이전트 소유)
5. SDK 정확한 사용법과 **공식 테스트 키**는 https://docs.tosspayments.com 에서 확인할 것 (v2 위젯 문서). 키는 환경변수 우선, 없으면 문서의 공개 테스트 키 폴백 → 데모 모드에서 바로 동작

## 관리자 인증 — `lib/auth.ts` (admin 에이전트 소유)

- `POST /api/admin/login`: `password === process.env.ADMIN_PASSWORD` → jose HS256 JWT(만료 7일)를 httpOnly/secure/sameSite=lax 쿠키 `limfruits_admin`으로 발급
- `middleware.ts`: matcher `['/admin/:path*']`, `/admin/login` 제외, 쿠키 검증 실패 시 `/admin/login`으로 redirect. admin API 라우트도 각자 검증 헬퍼 호출
- 데모 기본값: `ADMIN_PASSWORD` 미설정 시 `limfruits` (README에 경고 명시)

## 환경변수 (`.env.example` — foundation 소유)

```
NEXT_PUBLIC_TOSS_CLIENT_KEY=   # 토스 클라이언트 키 (미설정 시 문서 공개 테스트 키)
TOSS_SECRET_KEY=               # 토스 시크릿 키 (서버 전용)
SUPABASE_URL=                  # 미설정 시 인메모리 데모 모드
SUPABASE_SERVICE_ROLE_KEY=     # 서버 전용. NEXT_PUBLIC 금지
ADMIN_PASSWORD=
AUTH_SECRET=                   # 관리자 JWT 서명 키 (32자 이상 랜덤)
```

## 파일 소유권 (병렬 작업 규칙)

| 에이전트 | 소유 (생성/수정 가능) |
|---|---|
| foundation | `app/layout.tsx`, `app/globals.css`, `components/ui/*`, `components/site/Header.tsx`, `components/site/Footer.tsx`, `lib/types.ts`, `lib/db.ts`, `lib/db-memory.ts`, `lib/db-supabase.ts`, `lib/format.ts`, `supabase/schema.sql`, `.env.example`, `PLACEHOLDERS.md` |
| home | `app/page.tsx`, `components/home/*` |
| checkout | `app/order/**`, `app/api/orders/**`, `components/order/*`, `lib/toss.ts` |
| admin | `app/admin/**`, `app/api/admin/**`, `lib/auth.ts`, `middleware.ts` |

- 남의 소유 파일은 **읽기만**. 수정이 필요하면 `notes/<자기이름>.md`에 요청 내용을 적을 것 (integration 단계에서 반영)
- feature 에이전트는 `npm run build`/`npm run dev` 실행 금지 (병렬 충돌). 타입 확인은 `npx tsc --noEmit`로 하되 **자기 소유 파일의 에러만** 처리
- `lib/format.ts`: `formatWon(n)` → "27,000원", `normalizePhone(s)` → 숫자만, `formatPhone(s)` → 010-1234-5678

## 공통 컨벤션

- 기본은 server component, 상호작용 필요한 곳만 `'use client'`
- 금액은 원 단위 정수만. 부동소수점 금지
- 모바일 퍼스트. 특히 `/admin`은 부모님이 폰으로 쓰시므로 글자 크게, 터치 타깃 44px+, 상태 변경은 큰 버튼으로
- 에러는 사용자에게 한국어로 친절하게 (라이브러리 에러 메시지 노출 금지)
- 실제 정보가 필요한 placeholder(상호, 사업자번호, 전화, 실제 가격 등)는 `PLACEHOLDERS.md`에 항목 추가
