# 임과일 (limfruits) 아키텍처 명세 v2

과일 직판 쇼핑몰. **다중 상품(카탈로그 → 상세페이지 → 결제)** 구조 — 스마트스토어처럼 품목을 먼저 고르고 상세페이지에서 옵션을 선택해 구매한다. 첫 상품은 나주배.
이 문서는 모든 구현 에이전트의 **계약서**다. 여기 정의된 인터페이스/경로/이름을 임의로 바꾸지 말 것.

## 스택

- Next.js 15 App Router + TypeScript + Tailwind v4
- 결제: `@tosspayments/tosspayments-sdk` (v2 결제위젯)
- DB: Supabase — **환경변수 없으면 인메모리 데모 모드로 자동 폴백**
- 관리자 세션: `jose` JWT + httpOnly 쿠키 (`lib/auth.ts` 구현 완료, 변경 금지)
- 주소검색: 다음(카카오) 우편번호 서비스
- 외부 UI 라이브러리 금지. Tailwind만. UI 텍스트는 전부 한국어.

## 라우트 맵 v2

| 경로 | 설명 |
|---|---|
| `/` | 홈: 컴팩트 히어로 + **상품 카탈로그 그리드**(카드: 대표이미지/이름/부제/"19,000원~" 최저가/품절 뱃지) + 간단한 구매 안내. 카드 → `/products/[id]` |
| `/products/[id]` | **상품 상세**: 이미지 영역(사진 없으면 브랜드 일러스트 placeholder), 이름/부제, 옵션 select + 수량 + 합계 + "구매하기"(데스크톱은 우측 스티키 패널, 모바일은 하단 고정 바), 아래로 상세 본문(문단), 배송/교환·환불 안내. 구매하기 → `/order?option=<id>&qty=<n>` |
| `/order` | 주문·결제. `?option=<id>` **필수** (없으면 `/`로 redirect), `&qty=` 반영. 해당 옵션의 소속 상품명 + 같은 상품의 다른 옵션으로 변경 가능. 이후 흐름은 v1과 동일 |
| `/order/success` `/order/fail` `/order/complete/[orderNo]` `/order/lookup` | v1 그대로 (변경 최소화) |
| `/admin` `/admin/orders/[orderNo]` `/admin/login` | v1 그대로 |
| `/admin/products` | **상품 목록**: 카드(이름, 노출 상태, 옵션 수, 최저가) + "상품 추가" 버튼(이름만 입력하면 생성 후 편집으로 이동) |
| `/admin/products/[id]` | **상품 편집**: 이름/부제/대표이미지 URL/상세 본문(textarea)/노출 토글 + **옵션 관리**(목록 인라인 수정: 이름·설명·가격·품절 / 옵션 추가 / 옵션 삭제) |

헤더 내비: 홈 `/`, 주문조회 `/order/lookup`. ("주문하기" 링크는 제거 — 주문은 상품 상세에서 시작)

### API v2

| 메서드/경로 | 설명 |
|---|---|
| `POST /api/orders` | v1과 동일하되 item 스냅샷에 productId/productName 포함. orderName 예: "나주배 가정용 3kg x 2" (상품명+옵션명) |
| `GET /api/orders/lookup` | v1 그대로 |
| `POST /api/admin/products` | `{ name, subtitle?, detail?, imageUrl?, isActive?, sortOrder? }` → 생성된 product 반환 |
| `PATCH /api/admin/products/[id]` | 부분 수정 |
| `DELETE /api/admin/products/[id]` | 상품 + 소속 옵션 삭제 (기존 주문의 스냅샷은 영향 없음) |
| `POST /api/admin/options` | `{ productId, name, description?, price, soldOut?, sortOrder? }` |
| `PATCH /api/admin/options/[id]` | v1 그대로 |
| `DELETE /api/admin/options/[id]` | 옵션 삭제 |

모든 admin API는 `requireAdmin()` 필수. 입력 검증: price 양의 정수, 이름 비어있으면 400.

## 데이터 모델 v2 — `lib/types.ts`

```ts
export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPING' | 'DONE' | 'CANCELED';

export interface Product {
  id: string;              // 'naju-pear' 같은 슬러그 또는 랜덤 id
  name: string;            // "나주배"
  subtitle: string;        // "아삭하고 과즙 가득, 산지에서 바로 보내드려요"
  imageUrl: string | null; // null이면 브랜드 일러스트 placeholder 렌더
  detail: string;          // 상세 본문. 빈 줄로 문단 구분하는 플레인 텍스트
  isActive: boolean;       // false면 카탈로그/상세 비노출 (admin에서만 보임)
  sortOrder: number;
}

export interface ProductOption {
  id: string;
  productId: string;
  name: string;         // "가정용 3kg" (상품명 중복 제거 — 상품에 소속되므로)
  description: string;  // "5~7과 · 알뜰 실속형"
  price: number;        // 원 단위 정수, 배송비 포함가
  soldOut: boolean;
  sortOrder: number;
}

export interface OrderItem {
  productId: string;
  productName: string;  // 주문 시점 스냅샷
  optionId: string;
  optionName: string;   // 스냅샷
  unitPrice: number;
  quantity: number;
}

// Order 는 v1 그대로 (items 타입만 위 OrderItem)
```

## 저장소 추상화 v2 — `lib/db.ts`

```ts
export interface Store {
  // 상품
  listProducts(includeInactive?: boolean): Promise<Product[]>;   // sortOrder 순
  getProduct(id: string): Promise<Product | null>;
  createProduct(input: { name: string; subtitle?: string; imageUrl?: string | null; detail?: string; isActive?: boolean; sortOrder?: number }): Promise<Product>;
  updateProduct(id: string, patch: Partial<Omit<Product, 'id'>>): Promise<void>;
  deleteProduct(id: string): Promise<void>;                       // 소속 옵션 cascade
  // 옵션
  listOptions(productId?: string): Promise<ProductOption[]>;      // productId 생략 시 전체
  getOption(id: string): Promise<ProductOption | null>;
  createOption(input: { productId: string; name: string; description?: string; price: number; soldOut?: boolean; sortOrder?: number }): Promise<ProductOption>;
  updateOption(id: string, patch: Partial<Omit<ProductOption, 'id' | 'productId'>>): Promise<void>;
  deleteOption(id: string): Promise<void>;
  // 주문 — v1 그대로
  createOrder(...): Promise<Order>; getOrderByNo; findOrder; listOrders; markPaid; updateOrder;
}
export function getStore(): Store;
```

- 시드: 상품 1개 `naju-pear` "나주배" (subtitle/상세 본문 포함, 상세 본문은 나주배 소개 3~4문단) + 옵션 4개(가정용 3kg 19,000 / 가정용 5kg 27,000 / 선물세트 5kg 35,000 / 선물세트 7.5kg 45,000 — 이름에서 "나주배" 접두 제거)
- `supabase/schema.sql`: `products` 테이블 추가, `product_options.product_id` FK(ON DELETE CASCADE), RLS enable + 정책 없음, 시드 갱신. (아직 라이브 Supabase 없음 — 신규 설치 기준으로 재작성, 마이그레이션 파일 불필요)

## 결제 플로우 — v1 그대로

`/order` → `POST /api/orders`(서버 금액 계산) → 토스 위젯 requestPayment → `/order/success`에서 금액 검증 + confirm → complete. `lib/toss.ts`, `lib/order-token.ts`, `lib/auth.ts` 는 완성된 코드 — **이번 라운드에서 수정 금지**.

## 파일 소유권 (이번 라운드)

| 에이전트 | 소유 |
|---|---|
| data | `lib/types.ts`, `lib/db.ts`, `lib/db-memory.ts`, `lib/db-supabase.ts`, `supabase/schema.sql` |
| storefront | `app/(site)/**`, `app/api/orders/**`, `components/home/*`, `components/product/*`(신규), `components/order/*`, **디자인 시스템 전체**: `app/layout.tsx`, `app/globals.css`, `components/ui/*`, `components/site/*` (BRAND v2 리디자인 담당. 단 `components/ui/*`의 prop API — variant 이름 등 — 는 유지하고 스타일 내부만 변경: admin이 병렬로 사용 중) |
| admin | `app/admin/**`, `app/api/admin/**` |

- 공용(`lib/format.ts`, `lib/auth.ts`, `lib/toss.ts`, `lib/order-token.ts`)은 읽기 전용. 변경 필요 시 `notes/<이름>.md`
- data 단계가 먼저 완료된 뒤 storefront/admin이 병렬로 진행. **feature 에이전트는 `npm run build` 금지**, `npx tsc --noEmit`으로 자기 소유 파일 에러만 처리
- data 에이전트 완료 시점에는 기존 페이지들이 새 타입과 안 맞아 컴파일 에러가 나는 게 정상 (feature 에이전트가 고침). data는 `lib/**`와 `supabase/**`만 무결하면 됨

## 공통 컨벤션 — v1 그대로

server component 기본, 금액은 원 단위 정수, 모바일 퍼스트(특히 admin은 장년층 기준 큰 글씨·44px+ 터치 타깃), 에러는 한국어로 친절하게, placeholder는 `PLACEHOLDERS.md`에 기록.
