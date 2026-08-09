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
  detail: string;          // (구) 단순 본문. blocks 비어 있을 때의 폴백
  blocks: DetailBlock[];   // v2.1: 카드뉴스형 상세페이지 블록 (jsonb, 기본 [])
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

---

# v2.1 부록 — 카드뉴스형 상세페이지 블록

상품 상세를 스마트스토어 상세페이지처럼 **스크롤형 스토리(카드뉴스)**로 구성한다. 단, 비주얼은 참고 이미지의 핑크 감성이 아니라 **BRAND v2 프로페셔널 미니멀 톤**으로 렌더링한다 (콘텐츠 구성만 차용).

## DetailBlock 타입 — `lib/types.ts`

```ts
export type DetailBlock =
  | { type: 'heading'; label?: string; title: string }                          // 섹션 라벨(pill) + 큰 제목
  | { type: 'text'; body: string }                                              // 문단 (빈 줄 = 문단 구분)
  | { type: 'image'; url: string; caption?: string }                            // 풀폭 이미지 (긴 상세이미지 재사용 가능)
  | { type: 'point'; title: string; body: string; imageUrl?: string }           // Point N — 렌더 시 자동 번호
  | { type: 'badge'; title: string; body: string; imageUrl?: string }           // 인증·수상 배지
  | { type: 'specs'; title?: string; rows: { k: string; v: string }[] }         // 규격/구성 표
  | { type: 'notice'; title: string; body: string };                            // 강조 안내 박스 (포장/예약 등)
```

## 렌더링 — `components/product/DetailBlocks.tsx` (storefront 소유)

- `/products/[id]` 구매 패널 아래에 `blocks` 순서대로 렌더. `blocks` 비면 기존 `detail` 문단 폴백
- 카드뉴스 느낌: 섹션 라벨은 중앙 pill, 제목은 크게(tracking-tight), 넉넉한 세로 여백, heading 단위로 white/surface 배경 교차. point 는 자동 번호(01, 02…) + 이미지 있으면 좌우 교차 배치. specs 는 헤어라인 표. notice 는 surface 박스
- 이미지는 next/image 원격 URL 대신 일반 `<img>` + `loading="lazy"` (임의 도메인 URL 허용을 위해). `url` 은 `https://` 또는 `/` 로 시작하는 것만 렌더 (javascript: 등 차단)
- 텍스트는 전부 React 텍스트 노드로 (dangerouslySetInnerHTML 금지)

## 관리자 편집 — `/admin/products/[id]` (admin 소유)

- "상세페이지 구성" 섹션 추가: 블록 목록(타입 한글 라벨: 제목/문단/사진/포인트/인증 배지/규격 표/안내 박스) — 각 블록 카드에 필드 편집, ↑↓ 순서 이동, 삭제, "+ 블록 추가"(타입 선택). 저장 시 blocks 배열 전체를 PATCH
- 장년층 기준: 타입별 입력 필드에 예시 placeholder, 저장 성공 피드백 명확히

## API·검증

- `PATCH /api/admin/products/[id]` body 에 `blocks?: DetailBlock[]` 허용 — 서버 검증: 배열 최대 60개, 각 블록 type 화이트리스트, 필수 필드 존재, 문자열 길이 상한(제목 200자/본문 5000자/url 1000자), image url 은 https:// 또는 / 시작만 허용. specs rows 최대 30개
- `POST /api/admin/products` 는 blocks 없이 생성(기본 [])

## 저장

- 메모리: Product.blocks 배열 그대로. Supabase: `products.blocks jsonb not null default '[]'`
- 시드 (data 소유, 두 스토어 동일): **나주배 한 상품만.** 사용자의 옛 스마트스토어 상세페이지는 **형식 참고용**이다 — 거기 나온 복숭아 콘텐츠(품종·brix·과수·인증)를 나주배에 옮겨 적지 마라. 나주배 blocks 구성:
  - heading(label "임과일 나주배", title 짧고 단정하게) + text: 나주 지역이 배 산지로 알려진 이유(일조량·토질 수준의 일반 사실만)와 아삭한 식감·풍부한 과즙 소개. 품종명·당도 등 확인 안 된 구체 수치는 쓰지 말 것
  - point 3개: ① 산지 직송 — 일반적인 다단계 유통(농장→경매→도매→소매) 대신 농장에서 택배로 바로 발송 ② 당도 관리 — 수확 시기를 확인해 발송한다는 내용, 구체 수치 자리는 "OO brix" placeholder ③ 재배부터 수확·선별·포장까지 직접
  - specs(title "상품 구성"): 기존 옵션 4개(가정용 3kg·5kg / 선물세트 5kg·7.5kg)와 과수 placeholder("O~O과")
  - notice: 포장·배송 — 완충 포장, 수확 후 신속 발송, 농산물 특성상 크기·모양 상이 가능 고지
  - heading+text: 생산지 — 전라남도 나주시 덕룡로 33-8 (풍천대봉감농원)
  - 인증 배지(GAP 등)는 시드에 넣지 않는다 — 배 상품에 해당하는지 미확인. badge 블록 타입만 제공하고, PLACEHOLDERS.md 에 "GAP·로컬푸드 인증을 배에도 표기할지 확인 후 관리자에서 badge 블록 추가" 항목을 남길 것
  - 사진 자리(image 블록)는 시드에서 생략, PLACEHOLDERS.md 에 기록
- 기존 주문·옵션 로직은 변경 없음

## 파일 소유권 (v2.1 라운드)

| 에이전트 | 소유 |
|---|---|
| data | `lib/types.ts`, `lib/db.ts`, `lib/db-memory.ts`, `lib/db-supabase.ts`, `supabase/schema.sql` |
| storefront | `components/product/**`, `app/(site)/products/**` |
| admin | `app/admin/**`, `app/api/admin/**` |

그 외 파일은 읽기 전용(변경 요청은 `notes/<이름>.md`). `lib/auth.ts`·`lib/toss.ts`·`lib/order-token.ts` 수정 금지.

---

# v2.2 부록 — 구매자 포토 리뷰

회원가입 없는 사이트이므로 **주문번호 + 전화번호 인증(주문조회와 동일)** 을 통과한 구매자만 리뷰를 쓴다. 주문 1건당 리뷰 1개.

## 데이터 모델 — `lib/types.ts`

```ts
export type ReviewStatus = 'VISIBLE' | 'HIDDEN';

export interface Review {
  id: string;            // uuid
  productId: string;
  orderNo: string;       // 주문당 1개 (unique)
  authorName: string;    // 주문자명 원본 저장. 화면 표시는 항상 마스킹(김*원)
  phone: string;         // 숫자만. 검증용 — API 응답·화면에 절대 노출 금지
  rating: number;        // 1~5 정수
  body: string;          // 10~2000자
  photos: string[];      // Storage 공개 URL 최대 3개
  status: ReviewStatus;  // 기본 VISIBLE, 관리자가 숨김 가능
  createdAt: string;
}
```

## Store 확장 — `lib/db.ts`

```ts
createReview(input: { productId; orderNo; authorName; phone; rating; body; photos }): Promise<Review>;
getReviewByOrderNo(orderNo: string): Promise<Review | null>;
listReviews(params?: { productId?: string; includeHidden?: boolean; limit?: number }): Promise<Review[]>; // 최신순
setReviewStatus(id: string, status: ReviewStatus): Promise<void>;
deleteReview(id: string): Promise<void>;
```

- `supabase/schema.sql`: `reviews` 테이블(order_no unique, product_id index, RLS enable + 정책 없음). 시드 없음
- 메모리 스토어: 동일 동작. **데모 모드에서는 사진 업로드가 불가하므로 사진은 무시**(응답에 안내 포함)

## 사진 저장 — `lib/storage.ts` (data 소유, 신규)

- `uploadReviewPhoto(orderNo, index, file: { bytes: ArrayBuffer; contentType })` → 공개 URL
- Supabase Storage REST 사용. **주의: `Authorization: Bearer`가 아니라 `apikey` 헤더로 인증** (sb_secret 키는 Bearer JWT 파싱에서 거부됨)
- 버킷 `reviews`(public). 업로드 전 버킷 생성 시도(이미 있으면 409 무시) — 신규 설치에도 자동 동작
- 경로: `reviews/{orderNo}/{index}.{ext}`

## API

| 메서드/경로 | 설명 |
|---|---|
| `POST /api/reviews` | multipart FormData: `orderNo, phone, rating, body, photos[]`(최대 3). 검증 순서: ① `findOrder(orderNo, phone)` 실패 시 404 ② 주문 상태 SHIPPING/DONE 아니면 400("상품을 받으신 뒤 작성할 수 있습니다") ③ 이미 리뷰 있으면 409 ④ rating 1~5 정수, body 10~2000자 ⑤ 사진: 각 5MB 이하, **매직 바이트로 실제 이미지(jpeg/png/webp) 확인**(Content-Type 헤더만 믿지 말 것), 3장 초과 400. 성공 시 생성된 리뷰 반환(phone 제외) |
| `PATCH /api/admin/reviews/[id]` | `{ status }` — requireAdmin |
| `DELETE /api/admin/reviews/[id]` | requireAdmin. Storage의 해당 사진 객체도 삭제 시도(실패해도 행 삭제는 진행) |

공개 GET API는 없음 — 상세페이지가 server component에서 store를 직접 읽는다.

## 화면

- **작성 진입**: `/order/lookup` 조회 결과에서 SHIPPING/DONE 주문에 "리뷰 쓰기" 버튼(이미 리뷰 있으면 "리뷰 작성 완료" 비활성). 클릭 시 **같은 화면에서 인라인 폼 확장** (조회에 쓴 orderNo·phone을 클라이언트 state로 재사용 — URL로 전화번호를 넘기지 말 것). 별점(큰 터치 타깃 star picker), 본문 textarea, 사진 선택(최대 3장, 선택 즉시 썸네일 미리보기·개별 제거), 제출 → 성공 시 "리뷰가 등록되었습니다" + 상품 페이지 링크
- **상품 상세**(`/products/[id]`): 상세 블록 아래 "구매 후기" 섹션 — 평균 별점(★ 채움)과 개수 요약, 리뷰 카드 목록(마스킹 이름 · 날짜 · 별점 · 사진 썸네일 가로 스크롤 · 본문). 사진 탭 시 원본을 새 탭으로. 리뷰 0개면 "아직 후기가 없습니다. 첫 후기를 남겨 주세요" + 주문조회 링크. 최근 30개 표시
- **주문 완료 페이지**: "상품을 받으신 뒤 주문조회에서 후기를 남길 수 있습니다" 한 줄 추가
- **관리자** `/admin/reviews` (AdminNav에 "리뷰" 추가): 전체 리뷰 목록(숨김 포함, 상품명·마스킹 아닌 실명·별점·본문·사진·상태) — 카드마다 "숨기기/보이기" 토글과 "삭제"(confirm). 장년층 기준 큰 버튼

## 파일 소유권 (v2.2 라운드)

| 에이전트 | 소유 |
|---|---|
| data | `lib/types.ts`, `lib/db.ts`, `lib/db-memory.ts`, `lib/db-supabase.ts`, `lib/storage.ts`(신규), `supabase/schema.sql` |
| storefront | `app/api/reviews/**`, `components/review/*`(신규), `components/order/LookupForm.tsx`, `app/(site)/products/[id]/page.tsx`(리뷰 섹션 추가만), `app/(site)/order/complete/**`(안내 한 줄), `app/(site)/order/lookup/**` |
| admin | `app/admin/**`, `app/api/admin/reviews/**` |

그 외 읽기 전용. `lib/auth.ts`·`lib/toss.ts`·`lib/order-token.ts` 수정 금지. 기존 결제·주문 로직 변경 금지.

---

# v2.3 부록 — AI 상담 챗봇 (Claude API tool-use 에이전트)

사이트 우측 하단 채팅 위젯. 단순 FAQ가 아니라 **도구를 실제로 호출하는 에이전트**: 상품·가격·품절은 DB를 실시간 조회하고, 주문 상태는 주문번호+전화번호 검증 후 안내한다.

## 환경변수

- `ANTHROPIC_API_KEY` — **없으면 위젯 자체를 렌더하지 않고**, `/api/chat`은 503. 키를 넣는 순간 활성화
- `CHAT_MODEL` — 기본 `claude-opus-5` (비용 절감 시 `claude-haiku-4-5`로 교체 가능)
- `CHAT_EFFORT` — 기본 `low` (상담 챗은 지연이 중요. `low|medium|high`만 허용)

## SDK 사용 계약 (`@anthropic-ai/sdk` 설치됨) — **이 시그니처를 그대로 쓸 것, 추측 금지**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';

const client = new Anthropic(); // ANTHROPIC_API_KEY 자동 인식

const listProducts = betaTool({
  name: 'list_products',
  description: '판매 중인 상품·옵션·가격·품절 여부를 조회한다. 상품/가격/재고 질문에는 반드시 이 도구를 먼저 호출한다.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  run: async () => JSON.stringify(/* getStore() 조회 결과 */),
});

const finalMessage = await client.beta.messages.toolRunner({
  model, max_tokens: 1024,
  output_config: { effort },
  system: SYSTEM_PROMPT,
  tools: [listProducts, getOrderStatus],
  messages,            // [{role:'user'|'assistant', content: string}] 그대로 전달 가능
  max_iterations: 5,
});
// 응답 텍스트 = finalMessage.content 중 type==='text' 블록들의 text 를 이어붙임
```

- 에러는 타입 클래스로 분기: `Anthropic.AuthenticationError`(→503 "상담 기능을 준비 중입니다"), `Anthropic.RateLimitError`·상태 529(→503 "상담이 몰리고 있어요. 잠시 후 다시 시도해 주세요"), 그 외 `Anthropic.APIError`(→500 일반 안내). 원문 에러 메시지를 클라이언트에 노출 금지
- `claude-opus-5`는 thinking이 기본 켜져 있음 — `thinking` 파라미터를 **보내지 말 것**. temperature/top_p 금지(400)

## 도구 2개 (`lib/chat.ts`)

1. `list_products` (인자 없음): 활성 상품별 { 상품명, 부제, 상세페이지 경로 `/products/<id>`, 옵션: [{이름, 가격(원), 품절}] }. getStore() 사용
2. `get_order_status` ({ orderNo: string, phone: string } 필수): `findOrder(orderNo, phone)` — 전화 불일치·부재 시 "주문을 찾을 수 없음"을 도구 결과로 반환(모델이 재확인 유도). 성공 시 { 상태(한글), 주문일, 상품 요약, 금액, 택배사, 운송장번호 }만 — **주소·전화번호는 절대 포함 금지**

## 시스템 프롬프트에 넣을 사실 (지어내기 방지 — 이 밖의 구체 수치는 말하지 말 것)

- 임과일: 풍천대봉감농원(전남 나주시 덕룡로 33-8)의 과일 직판. 신고배·풍수배·황금배 재배, 도라지배즙 판매. GAP 우수관리인증 제1006050호
- 가격은 배송비 포함. 주문 확인 후 산지에서 발송, 명절 성수기엔 주문 순서대로 순차 발송. 농산물 특성상 크기·모양 상이 가능. 배는 수령 후 냉장 보관 권장
- 문의: 010-2618-5151, 카카오톡 limcon1. 주문조회 페이지 `/order/lookup`
- 가드레일: 상품·가격·품절은 반드시 list_products 호출 후 답변(기억으로 답하지 말 것). 주문 상태는 주문번호+전화번호를 받아 get_order_status — 하나라도 없으면 정중히 요청. 환불·취소·결제 문제는 직접 처리 불가 → 전화 안내. 배송 소요일 등 확정 안 된 정보는 단정하지 말고 전화 안내. 과일과 무관한 질문은 짧고 정중하게 사양. 개인정보(주소·카드번호)는 묻지도 저장하지도 않음. 존댓말, 간결하게(2~4문장), 이모지 금지

## API — `POST /api/chat`

- body: `{ messages: { role: 'user'|'assistant', content: string }[] }`
- 검증: 배열 1~12개(초과 시 앞을 잘라 최근 12개만 사용), 각 content 1~500자(초과 400), role 화이트리스트, 마지막은 user
- 레이트리밋: IP당 10분에 20회(globalThis Map, 초과 429 한국어 안내). content-length 과대 요청 400
- 응답: `{ reply: string }`. 키 없으면 503

## 위젯 — `components/chat/ChatWidget.tsx` (client)

- 우측 하단 플로팅 버튼(그린 원형 56px, 말풍선 아이콘). 열면: 데스크톱 380×560px 카드(우하단 고정), 모바일 화면 대부분 차지하는 시트. BRAND v2 스타일
- 헤더 "임과일 상담" + 닫기. 첫 화면: 인사말 + 추천 질문 칩 3개("어떤 상품이 있나요?", "주문 배송 조회하고 싶어요", "선물용으로 뭐가 좋아요?")
- 메시지 목록(유저 우측 그린, 봇 좌측 서피스), 로딩 점 3개 애니메이션, 에러 시 말풍선로 한국어 안내 + 재시도
- 입력창 + 전송(Enter 전송, 전송 중 비활성). 대화는 sessionStorage `limfruits_chat` 유지(최근 12개만 서버 전송)
- 하단 면책 한 줄: "AI 상담이 정확하지 않을 수 있어요 · 문의 010-2618-5151"
- 마운트: `app/(site)/layout.tsx` (server component)에서 `process.env.ANTHROPIC_API_KEY` 있을 때만 렌더 → admin에는 안 뜸

## 파일 소유권 (v2.3 라운드)

| 에이전트 | 소유 |
|---|---|
| api | `lib/chat.ts`, `app/api/chat/route.ts` |
| widget | `components/chat/*`(신규), `app/(site)/layout.tsx`(위젯 마운트만) |

그 외 읽기 전용. `lib/auth.ts`·`lib/toss.ts`·`lib/order-token.ts` 수정 금지. 결제·주문·리뷰 로직 변경 금지.

---

# v2.4 부록 — 선물·대량 주문 (다중 배송지)

명절 선물 시나리오: 보내는 사람(주문자) ≠ 받는 사람, 받는 사람 여러 명, 받는 분마다 다른 구성 가능, **한 번에 결제**. 각 세트 가격이 "배송비 포함가"이므로 총액 = 각 배송 건의 (옵션가 × 수량) 합. 기존 단일 주문 흐름(`/order`)은 그대로 유지하고 **별도 경로**로 추가한다.

## 데이터 모델 — `lib/types.ts` (data 소유)

```ts
export type OrderKind = 'SINGLE' | 'GIFT';

export interface Shipment {
  id: string;             // 배송 건 id (짧은 랜덤)
  recipientName: string;
  phone: string;          // 숫자만 저장
  postcode: string;
  address1: string;
  address2: string;
  giftMessage: string;    // 선물 메시지(선택), 빈 문자열 허용
  items: OrderItem[];     // 이 받는 분에게 가는 구성(옵션·수량 스냅샷)
  courier: string | null; // 배송 건별 운송장
  trackingNo: string | null;
}
```

Order 확장(기존 필드 유지, 하위호환):
- `kind: OrderKind` — 기본 `'SINGLE'`. SINGLE 주문은 기존과 100% 동일(top-level customerName/phone/address = 받는 분, shipments = [])
- `shipments: Shipment[]` — GIFT 주문의 받는 분별 배송 건. SINGLE은 `[]`
- GIFT 주문에서 top-level `customerName`/`phone` = **보내는 분(주문자)**, top-level 주소 필드는 빈 문자열, `memo`는 주문 전체 메모. GIFT의 배송지·운송장은 **shipments 안에만** 존재
- `items`(top-level) = 모든 배송 건 items를 평탄화한 합(총액 계산·하위호환용). `totalAmount` = 그 합

## 저장소 — `lib/db.ts` (data 소유)

```ts
createGiftOrder(input: {
  senderName: string; senderPhone: string; memo: string;
  shipments: Array<{
    recipientName: string; phone: string; postcode: string;
    address1: string; address2: string; giftMessage: string;
    items: OrderItem[];   // 서버가 옵션 조회로 스냅샷 채움
  }>;
  totalAmount: number;
}): Promise<Order>;                    // kind:'GIFT', orderNo 생성
updateShipment(orderNo: string, shipmentId: string, patch: { courier?: string|null; trackingNo?: string|null }): Promise<void>;
```

- 메모리·Supabase 모두 구현. Supabase: `orders`에 `kind text not null default 'SINGLE'`, `shipments jsonb not null default '[]'` 컬럼 추가(멱등 `alter table ... add column if not exists`). 기존 `createOrder`/`updateOrder`/조회는 그대로 두고 kind/shipments를 함께 매핑. **기존 설치 사용자는 이 두 컬럼 추가 SQL만 다시 실행하면 됨**
- `db-memory.ts`: Order에 kind/shipments 포함해 반환(기존 주문은 kind:'SINGLE', shipments:[]). 싱글턴 키 올림

## 결제 플로우 — 기존 것 재사용, 변경 금지

`/order/success`·`confirmPayment`·금액 검증은 orderNo+totalAmount 기반이라 주문 종류와 무관하게 그대로 동작. **success/fail/toss.ts/order-token.ts 절대 수정 금지.** GIFT 주문도 `POST /api/orders/gift`가 PENDING 주문을 만들고 `{ orderNo, amount, orderName }`을 돌려주면 나머지는 동일.

## API (checkout 소유)

| 경로 | 설명 |
|---|---|
| `POST /api/orders/gift` | body: `{ senderName, senderPhone, memo, shipments: [{ recipientName, phone, postcode, address1, address2, giftMessage, optionId, quantity }] }`. 검증: 배송 건 1~100개, 각 옵션 DB 조회(품절·비활성 거부), 수량 1~99, 이름·연락처·주소 필수, giftMessage 200자 이하. **금액은 서버가 옵션가로 계산**. orderName 예: "나주배 선물세트 7.5kg 외 4건". 반환 `{ orderNo, amount, orderName }` |
| `GET /api/orders/gift/template` | 받는 분 명단 엑셀 양식 다운로드(빈 양식: 받는분성명/전화번호/우편번호/주소/상세주소/상품옵션/수량/선물메시지 헤더 + 예시 1행) |

## 화면 (checkout 소유)

- **진입**: 홈·상품 상세에 "선물·대량 주문" 링크 → `/order/gift`
- `/order/gift` (client): 
  - **받는 분 카드 목록**(장바구니). 각 카드 = 상품·옵션 select(활성·재고 있는 옵션만) + 수량 + 받는 분 성함·연락처 + 주소(다음 우편번호 검색) + 선물 메시지 + 삭제. "받는 분 추가" 버튼
  - **엑셀 대량 업로드**: 양식 다운로드 링크 + 파일 선택 → **클라이언트에서 xlsx 파싱**(이미 설치됨) → 상품옵션 텍스트를 옵션명과 매칭해 유효 행을 카드로 추가, 매칭 실패·검증 실패 행은 "N행: 사유" 목록으로 안내(전체 실패시키지 말고 유효분만 추가). 전화/우편번호 정규화
  - 보내는 분(주문자) 성함·연락처 입력(1회)
  - 합계(모든 건 합) 크게 + 배송 건 수 표시. 하단 고정 바
  - "결제하기" → `POST /api/orders/gift` → 토스 위젯 `requestPayment`(OrderForm과 동일 패턴, orderName/amount 서버 값 사용). 위젯·결제 흐름 코드는 OrderForm 방식 재사용하되 **결제 코어는 건드리지 않음**
  - BRAND v2 스타일, 모바일 퍼스트

## 관리자 (admin 소유)

- **주문 목록**(`/admin`): GIFT 주문은 카드에 "선물 N건" 뱃지, 요약은 "홍길동 외 N명"
- **주문 상세**(`/admin/orders/[orderNo]`): `kind==='GIFT'`이면 보내는 분 정보 + **배송 건 목록** 렌더. 각 건: 받는 분·연락처(tel:)·주소(복사 버튼)·구성·선물 메시지 + **건별 택배사 select + 운송장 입력 → 저장**(PATCH). SINGLE은 기존 UI 그대로
- `PATCH /api/admin/orders/[orderNo]` 확장: body에 `shipmentId`가 있으면 `updateShipment` 호출(그 건의 courier/trackingNo만). 없으면 기존 동작. requireAdmin 유지
- **GIFT 주문 상태 전이**: 모든 배송 건에 운송장이 입력되면 관리자가 "전체 발송 처리"로 주문을 SHIPPING으로. (건별 상태까지는 v1 범위 밖 — 주문 단위 상태 유지)

## 로젠 엑셀 왕복 — 다중 배송지 대응 (admin 소유)

- **내보내기**(`/api/admin/orders/export`): 행 단위를 **배송 건**으로 변경. SINGLE 주문은 1행(기존), GIFT 주문은 배송 건마다 1행. 각 행에 **배송건번호** 열 추가 — SINGLE은 `orderNo`, GIFT는 `orderNo#1`, `orderNo#2`… (건 순번). 받는분/주소/품목은 그 건 기준. "보내는분" 열 추가
- **가져오기**(`/api/admin/orders/import-tracking`): 배송건번호 파싱 — `#n`이 있으면 해당 주문의 n번째 배송 건 운송장 저장(updateShipment), 없으면 기존 주문 단위 저장. 나머지(인코딩·헤더 매칭·스킵 사유)는 기존 로직 유지

## 파일 소유권 (v2.4 라운드)

| 에이전트 | 소유 |
|---|---|
| data | `lib/types.ts`, `lib/db.ts`, `lib/db-memory.ts`, `lib/db-supabase.ts`, `supabase/schema.sql` |
| checkout | `app/api/orders/gift/**`(신규), `app/(site)/order/gift/**`(신규), `components/order/gift/*`(신규), `components/home/*`·`app/(site)/products/[id]/page.tsx`·`components/product/*`(선물 주문 진입 링크 추가만) |
| admin | `app/admin/**`, `app/api/admin/orders/**`, `components/admin/*` |

그 외 읽기 전용. **`app/(site)/order/success/**`·`app/(site)/order/fail/**`·`lib/toss.ts`·`lib/order-token.ts`·`lib/auth.ts` 절대 수정 금지.** 기존 단일 주문(`/order`, `POST /api/orders`)·결제·리뷰·챗봇 로직 변경 금지.
