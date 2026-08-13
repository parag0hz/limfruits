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

---

# v2.5 부록 — UX 개선 (히어로·구매 패널·리뷰 노출·선물 진입·챗봇 위치)

실제 렌더 화면 검토에서 나온 전환·완성도 개선. **상품 사진/콘텐츠는 이번 범위 아님**(사장 피드백 대기). 기존 결제·주문·데이터 계약 변경 없음, 시각/구조만 개선.

## 개선 항목 (storefront 소유, 챗봇 위치만 widget 소유)

1. **홈 히어로 (`components/home/Hero.tsx`)**
   - 헤드라인 유지하되 **CTA 버튼 2개 추가**: "상품 보기"(아래 카탈로그로 스무스 스크롤 또는 첫 상품) + "선물·대량 주문"(→ /order/gift, outline). Button 컴포넌트 재사용
   - 데스크톱 상단 여백 과다 축소(상품이 첫 화면에 더 걸리게), 모바일 헤드라인 줄바꿈 어색함 정리(`text-balance` 또는 폭 조정)
2. **상품 카드 리뷰 노출 (`components/home/ProductGrid.tsx` + `app/(site)/page.tsx`)**
   - CatalogItem 에 `reviewCount: number`, `reviewAverage: number` 추가. page.tsx(server)에서 `getStore().listReviews({})`(VISIBLE 전체)를 한 번 불러 productId 별 {count, 평균(소수1)} 집계해 전달. **store 인터페이스 변경 없이 페이지에서 집계**
   - 카드에 별점(★ 평균) + "(후기 N)" 작게 표시. 후기 0개면 미표시(빈 값 강요 금지). 별 아이콘은 인라인 SVG/문자
3. **상품 상세 구매 패널 (`components/product/BuyPanel.tsx`)**
   - **옵션 미선택 시 "구매하기" 비활성**: 현재 `disabled={allSoldOut}` → `disabled={allSoldOut || !selectedOptionId}`. 미선택 시 버튼 아래(또는 위)에 "구성을 선택해 주세요" 안내 문구. 데스크톱 패널·모바일 하단 바 **양쪽 동일 적용**
   - **데스크톱에도 구매 접근 유지**: 현재 하단 바가 `lg:hidden`이라 데스크톱엔 없음 → 데스크톱 구매 패널을 스크롤에 따라오게(`lg:sticky lg:top-24` 등, 상단 이미지+패널 영역이 상세 본문과 함께 스크롤될 때 패널이 뷰포트에 남도록). 긴 상세(수천 px)에서 맨 위로 안 올라가도 구매 가능하게. sticky 구현이 레이아웃상 어려우면 데스크톱에도 하단 sticky 바 노출(모바일 바의 lg:hidden 해제 + 데스크톱 폭 대응)
4. **상품 상세 상단 리뷰 요약 (`app/(site)/products/[id]/page.tsx` + 구매 패널/제목 영역)**
   - 상품명·부제 근처에 별점 평균 + "후기 N개" 요약(클릭 시 하단 후기 섹션으로 앵커 스크롤). 후기 0개면 미표시. ReviewSection 이 이미 집계하므로 동일 집계를 상단에도 전달(중복 쿼리 피하려면 page에서 한 번 조회해 상단·하단 공유)
5. **선물·대량 주문 진입 강화**
   - 홈: 하단의 작은 텍스트 링크 → 카탈로그 아래(또는 히어로 CTA)에 눈에 띄는 **버튼/배너**로 승격("여러 곳에 선물 보내기 · 엑셀로 한 번에")
   - 상품 상세 구매 패널의 선물 링크도 버튼 톤 유지(과하지 않게)
6. **챗봇 FAB 위치 (`components/chat/ChatWidget.tsx`, widget 소유)**
   - 플로팅 버튼이 홈 상품 카드/콘텐츠와 겹쳐 보임 → z-index·위치·여백 조정으로 콘텐츠를 가리지 않게. 기존 /products·/order 경로별 위치 로직은 유지하되 홈에서 카드 위에 얹히는 문제 완화(예: 우하단 여백 확대 또는 카드 그리드 우측 패딩)

## 제약

- BRAND v2 톤 유지(이모지·느낌표 금지, 그린 액센트, 헤어라인). 새 라이브러리 금지
- 결제·주문·리뷰·챗봇 **로직·API·데이터 계약 변경 금지** — 시각/구조/문구만
- 리뷰 집계는 VISIBLE 만, 페이지 레벨 server component 에서. `lib/db.ts` 인터페이스·`lib/toss.ts`·`lib/auth.ts`·`lib/order-token.ts`·결제 성공/실패 페이지 수정 금지
- 모바일·데스크톱 둘 다 확인. 구매 플로우(옵션 선택→구매하기→/order) 회귀 없어야

## 파일 소유권 (v2.5 라운드)

| 에이전트 | 소유 |
|---|---|
| storefront | `components/home/*`, `app/(site)/page.tsx`, `components/product/*`, `app/(site)/products/[id]/page.tsx`, `components/order/gift/*`(선물 진입 버튼 톤만), `components/ui/*`(필요 시 Stars 등 추가 — 기존 prop API 유지) |
| widget | `components/chat/ChatWidget.tsx` |

그 외 읽기 전용.

---

# v2.6 부록 — 입장 팝업 (추석/명절 발송 캘린더 + "오늘 하루 보지 않기")

한국 쇼핑몰 스타일 입장 팝업. 추석/설 선물세트 예약·발송 기간을 캘린더로 안내. **날짜·문구·on/off는 관리자에서 설정**(부모님이 시즌마다 켜고 끔), 코드 수정 불필요. 날짜 미확정이므로 **기본 enabled:false**(라이브에 잘못된 날짜 노출 방지), 관리자가 켜면 노출.

## 데이터 모델 — `lib/types.ts` (data 소유)

```ts
export interface Promo {
  enabled: boolean;                 // 노출 on/off (기본 false)
  title: string;                    // "추석 선물세트 예약 안내"
  body: string;                     // 안내 문구(여러 줄, 빈 줄=문단)
  shipStart: string | null;         // 'YYYY-MM-DD' 발송 시작일
  shipEnd: string | null;           // 'YYYY-MM-DD' 발송 마감일
  reserveDeadline: string | null;   // 'YYYY-MM-DD' 예약 마감일(선택)
  ctaLabel: string;                 // "선물 주문하기"
  ctaHref: string;                  // "/order/gift" (내부 경로 '/' 시작만)
}
```

## 저장소 — `lib/db.ts` (data 소유)

```ts
getPromo(): Promise<Promo>;                       // 없으면 기본값 반환
updatePromo(patch: Partial<Promo>): Promise<void>;
```

- Supabase: `site_settings (key text primary key, value jsonb not null default '{}')` 테이블(멱등 create). promo 는 key='promo' 한 행. RLS enable + 정책 없음. **기존 설치 사용자는 이 테이블 생성 SQL만 실행하면 됨**
- 메모리: promo 필드. 기본값(enabled:false, title/body/CTA 예시 채움, 날짜는 예시로 채우되 enabled:false). 싱글턴 키 올림 불필요(신규 필드는 기본값 병합)
- 기본값 상수(lib/db.ts 또는 types): `{ enabled:false, title:'추석 선물세트 예약 안내', body:'주문해 주신 순서대로 산지에서 순차 발송합니다.\n신선하게 받으실 수 있도록 정성껏 준비하겠습니다.', shipStart:null, shipEnd:null, reserveDeadline:null, ctaLabel:'선물 주문하기', ctaHref:'/order/gift' }`

## API (admin 소유)

- `PATCH /api/admin/promo` — requireAdmin. body 검증: enabled boolean, title/ctaLabel ≤80자, body ≤1000자, 날짜는 빈 문자열/null 또는 `^\d{4}-\d{2}-\d{2}$` 형식만(유효 날짜), ctaHref 는 '/' 시작 내부 경로만(javascript: 등 거부), shipEnd ≥ shipStart(둘 다 있으면). updatePromo 호출
- 공개 GET API 없음 — 팝업 데이터는 `(site)/layout.tsx`(server)가 getPromo()로 읽어 prop 전달

## 팝업 — `components/promo/*` (storefront 소유)

- `app/(site)/layout.tsx`(server, async 로 변경): `const promo = await getStore().getPromo();` → `promo.enabled` 이면 `<PromoPopup promo={promo} />` 렌더(비활성이면 아예 렌더 안 함, admin 영향 없음)
- `components/promo/PromoPopup.tsx` (client):
  - 마운트 시 노출 판단: localStorage `limfruits_promo_hidden_until`(YYYY-MM-DD)가 **오늘 이상**이면 표시 안 함. 아니면 표시. (SSR/hydration 안전: 초기 open=false, useEffect에서 판단해 open)
  - 모달(dialog, 배경 오버레이, 중앙 카드, 모바일은 폭 대응). 내용: 제목 → **발송 캘린더**(shipStart~shipEnd 강조) → body 문단 → 예약 마감일 안내(reserveDeadline 있으면 "예약 마감 M월 D일") → CTA 버튼(next/link, ctaHref) → 하단 바: "오늘 하루 보지 않기"(클릭 시 localStorage에 오늘 날짜 저장 후 닫기) + "닫기"(세션만 닫기)
  - BRAND v2 톤. 오버레이 클릭·Esc 로 닫기(세션), 포커스 트랩·aria-modal, 스크롤 락
- `components/promo/PromoCalendar.tsx`:
  - shipStart~shipEnd 가 걸친 달을 그리드로 렌더(1~2개월, 2개월 초과 span 은 2개월까지만 + "이후 순차 발송" 표기). 요일 헤더 일~토, 해당 월 날짜 셀. **발송 기간 날짜는 bg-brand text-white 강조**, 예약 마감일은 링/점으로 구분 표시. 날짜 없으면(shipStart null) 캘린더 생략하고 body만
  - 순수 계산(외부 라이브러리 금지). 로컬 타임존 이슈 피하려 'YYYY-MM-DD' 문자열 파싱은 UTC 기준 분해(Date 파싱 대신 split)

## 관리자 — `app/admin/(dashboard)/promo/*` + AdminNav (admin 소유)

- AdminNav 에 "팝업"(또는 "이벤트") 링크 추가(/admin/promo)
- `/admin/promo` (server + client 폼): getPromo() 초기값 → 노출 토글(크게), 제목, 안내 문구(textarea), 발송 시작·마감일·예약 마감일(date input), CTA 라벨·링크. 저장(PATCH) + 성공 피드백. 장년층 기준 큰 글씨·버튼. 간단한 미리보기(현재 값으로 팝업 프리뷰) 있으면 좋음(선택)

## 파일 소유권 (v2.6 라운드)

| 에이전트 | 소유 |
|---|---|
| data | `lib/types.ts`, `lib/db.ts`, `lib/db-memory.ts`, `lib/db-supabase.ts`, `supabase/schema.sql` |
| storefront | `components/promo/*`(신규), `app/(site)/layout.tsx`(팝업 마운트만) |
| admin | `app/admin/(dashboard)/promo/**`(신규), `app/api/admin/promo/**`(신규), `app/admin/(dashboard)/AdminNav.tsx`(링크 추가만) |

그 외 읽기 전용. 결제·주문·리뷰·챗봇·선물주문 로직 변경 금지. `lib/auth.ts`·`lib/toss.ts`·`lib/order-token.ts` 수정 금지.

---

# v2.7 부록 — 오픈 준비 (개인정보처리방침·이용약관·수신동의·SEO)

실제 오픈·토스 실결제 심사 전 필수. ① 법적 문서 페이지 ② 주문 시 동의 체크박스(필수 구매/개인정보 동의 + 선택 마케팅 수신동의) ③ SEO 기술 작업. 결제 금액·승인 로직 변경 금지(동의 체크는 결제 진행 게이트만).

## 확정 사업자 정보 (지어내지 말고 이 값만 사용)
- 상호: 풍천대봉감농원 · 대표자/개인정보 보호책임자: 임용균 · 연락처: 010-2618-5151
- 사업자등록번호: 412-90-42034 · 통신판매업신고: 제2011-전남나주-60호
- 주소: 전라남도 나주시 덕룡로 33-8 · 카카오톡: limcon1
- 시행일: 방침·약관 하단에 "시행일 2026-08-10" (오늘)
- 브랜드: 임과일 (limfruits), 나주배·황금배·도라지배즙 판매

## ① 법적 문서 (content 소유) — `app/(site)/privacy/page.tsx`, `app/(site)/terms/page.tsx`
- BRAND v2 타이포(긴 문서 페이지, max-w-3xl, 제목/소제목 위계, 표는 헤어라인). 텍스트는 React 노드(dangerouslySetInnerHTML 금지)
- **개인정보처리방침**(/privacy): 소상공인 쇼핑몰 표준 구성, 임과일 실제 데이터 흐름에 맞춤:
  - 수집 항목: 주문자 이름·연락처·주소·우편번호·주문/결제 내역, 배송메모, (선물주문) 받는 분 이름·연락처·주소, (리뷰) 사진, (선택) 마케팅 수신동의 여부. 결제정보는 토스페이먼츠가 처리(카드번호 등은 당사 미보관)
  - 수집·이용 목적: 주문 처리·배송·고객상담·후기 관리·(동의 시) 혜택/이벤트 안내
  - 보유·이용기간: 전자상거래법 근거 — 계약·청약철회 기록 5년, 대금결제·재화공급 기록 5년, 소비자 불만·분쟁처리 기록 3년, 표시·광고 기록 6개월. 목적 달성 시 지체 없이 파기
  - 제3자 제공: 배송을 위해 택배사(로젠택배 등)에 받는 분 성명·연락처·주소 제공
  - 처리위탁(수탁사·업무): 토스페이먼츠(결제 처리), 택배사(배송), Supabase(데이터 보관, 서울 리전), 알리고(주문 알림 문자, 이용 시), Anthropic(AI 상담 응대, 미국 — 이용 시). **국외 이전 항목(Anthropic·해당 시 호스팅)은 국외 처리 사실을 명시**
  - 정보주체 권리(열람·정정·삭제·처리정지 요청 방법: 보호책임자 연락처), 파기 절차·방법, 안전성 확보조치(접근권한 관리·암호화·접근통제), 만 14세 미만 미수집
  - 개인정보 보호책임자: 임용균 / 010-2618-5151, 방침 변경 시 공지, 시행일
- **이용약관**(/terms): 전자상거래 표준약관 수준 — 목적·정의, 회원 없이 비회원 주문임을 명시, 주문·결제, 청약철회·반품·교환(신선 농산물 특성상 단순변심 반품 제한·불량 시 교환/환불은 상세페이지 안내 준수), 배송, 면책, 분쟁해결·준거법
- 두 페이지 하단에 상호·사업자번호·통신판매업·대표·연락처·주소 표기
- Footer(`components/site/Footer.tsx`)에 "개인정보처리방침"(/privacy) · "이용약관"(/terms) 링크 추가. 주문/선물 폼의 동의 문구에서도 이 페이지로 링크

## ② 동의 체크박스 (checkout + data 소유)
- 데이터: Order 에 `marketingConsent: boolean`(기본 false) 추가. 선물주문은 보내는 분(주문자) 동의로 저장. createOrder/createGiftOrder input 에 marketingConsent 추가. schema.sql `orders` 에 `marketing_consent boolean not null default false` 멱등 추가(기존 설치 이 컬럼만 실행 가능). memory/supabase 매핑
- API: POST /api/orders, POST /api/orders/gift 가 `marketingConsent`(boolean, 기본 false) 받아 저장. **금액·기존 검증 로직 불변**
- UI(OrderForm, GiftOrderForm): 토스 결제위젯 약관과 **별개로**, 결제하기 직전에 상점 동의 블록:
  - [필수] "주문 내용을 확인했으며, 개인정보 수집·이용 및 [이용약관](/terms)·[개인정보처리방침](/privacy)에 동의합니다." — 미체크 시 결제 진행 차단(필드 옆 한국어 안내). 저장은 안 함(동의 안 하면 결제 자체 불가)
  - [선택] "광고성 정보(문자) 수신에 동의합니다. 명절·행사 소식을 보내드립니다." → marketingConsent 로 전송
  - 링크는 새 탭 target=_blank. 체크박스 44px 터치 타깃, BRAND v2
- (선택) 관리자 주문 상세에 "마케팅 수신동의: 동의/미동의" 표기(있으면 좋음, 없어도 됨)

## ③ SEO 기술 (seo 소유)
- `app/sitemap.ts`(Next MetadataRoute.Sitemap): 홈, 각 활성 상품 `/products/[id]`(listProducts), /order/gift, /order/lookup, /privacy, /terms. lastModified·priority 적정. `app/robots.ts`: allow /, **disallow /admin, /api, /order/success, /order/fail, /order/complete**; sitemap URL 지정. 둘 다 metadataBase(NEXT_PUBLIC_SITE_URL) 기준 절대 URL
- 메타데이터: 루트 layout 유지 + 상품 상세 `generateMetadata`(상품명 title, subtitle description, openGraph images=대표 imageUrl 있으면 그것 없으면 로고). 홈 description 검색 최적화 카피
- 구조화 데이터(JSON-LD, `<script type="application/ld+json">` — 정적 객체를 JSON.stringify, XSS 없게 서버에서 생성):
  - 홈/layout: Organization(임과일, 상호 풍천대봉감농원, 주소, 전화, sameAs 생략) + WebSite
  - 상품 상세: Product(name, image, description, brand 임과일, offers: 옵션 최저가 price·KRW·availability(재고 있으면 InStock)·priceValidUntil 생략, url) + 리뷰 있으면 aggregateRating(평균·개수). 옵션 여러 개면 offers 를 최저가 기준 또는 AggregateOffer(lowPrice/highPrice)
- 이미지·가격·별점이 검색결과에 뜨도록. 잘못된 정보 금지(재고·가격은 실제 값)

## 제약·주의
- 법적 문서는 **표준 양식 기반**이되 위 확정 사실만 사용, 없는 사실(수상·인증 과장 등) 금지. 페이지 자체엔 "템플릿" 표기 하지 말 것(정식 문서로 읽히게). 과장·허위 금지
- 결제 플로우 회귀 금지: 필수 동의 체크 후 정상 결제, 미체크 시 차단. 토스 약관(renderAgreement)은 그대로 유지하고 상점 동의는 별도
- `lib/toss.ts`·`lib/order-token.ts`·`lib/auth.ts`·결제 성공/실패 페이지 수정 금지

## 파일 소유권 (v2.7 라운드)
| 에이전트 | 소유 |
|---|---|
| data | `lib/types.ts`, `lib/db.ts`, `lib/db-memory.ts`, `lib/db-supabase.ts`, `supabase/schema.sql` |
| content | `app/(site)/privacy/**`(신규), `app/(site)/terms/**`(신규), `components/site/Footer.tsx`(링크 추가) |
| checkout | `components/order/OrderForm.tsx`, `components/order/gift/*`, `app/api/orders/route.ts`, `app/api/orders/gift/route.ts` |
| seo | `app/sitemap.ts`(신규), `app/robots.ts`(신규), `app/layout.tsx`(메타/JSON-LD), `app/(site)/page.tsx`(홈 메타/JSON-LD), `app/(site)/products/[id]/page.tsx`(generateMetadata + Product JSON-LD), `components/seo/*`(신규, JSON-LD 헬퍼) |

겹침 주의: `app/(site)/products/[id]/page.tsx` 는 seo 가 메타/JSON-LD만 추가(기존 렌더·구매패널 훼손 금지). `components/site/Footer.tsx` 는 content 가 링크만 추가. 그 외 읽기 전용. 결제·리뷰·챗봇·선물·auth·toss 로직 변경 금지.

---

# v2.8 부록 — 카카오 소셜 로그인 + 마이페이지 (회원제 Phase 2)

**비회원 주문은 그대로 유지.** 로그인은 편의(주문내역 마이페이지)만 — 돈(포인트/쿠폰)은 Phase 3. 카카오 키 없으면 **로그인 버튼 미노출 안전모드**(챗봇과 동일 패턴), 키 넣으면 켜짐.

## 환경변수 (env-gated)
- `KAKAO_REST_API_KEY` — 카카오 REST API 키. 없으면 로그인 비활성(버튼 미노출, /api/auth/kakao 503, /my 로그인 안내)
- `KAKAO_CLIENT_SECRET` — (선택, 카카오 보안 설정 시)
- redirect_uri = `${NEXT_PUBLIC_SITE_URL}/api/auth/kakao/callback` (없으면 요청 origin 유도). **카카오 개발자 앱에 이 redirect_uri 등록 필요**
- `AUTH_SECRET` 재사용(유저 세션 서명). 없으면 개발 폴백(admin과 동일 방침)

## 데이터 (data 소유)
```ts
export interface User { id: string; kakaoId: string; nickname: string; createdAt: string; }
// Order += userId: string | null  (비회원·기존 주문은 null)
```
- Store 추가: `getUserByKakaoId(kakaoId)`, `createUser({kakaoId,nickname})`, `getUser(id)`, `listOrdersByUser(userId)`(최신순), createOrder/createGiftOrder input 에 `userId?: string | null` 추가
- Supabase: `users(id uuid pk default gen_random_uuid(), kakao_id text unique not null, nickname text not null default '', created_at timestamptz not null default now())` RLS enable+정책없음; `orders` 에 `user_id text null` + index. **멱등**(create table if not exists / add column if not exists). 기존 설치 이 절만 실행 가능
- memory: users 배열, order.userId. 기존 주문/시드 userId=null

## 인증 (auth 소유) — `lib/user-auth.ts`(신규), `app/api/auth/**`(신규)
- lib/user-auth.ts: `kakaoConfigured():boolean`; `getKakaoAuthUrl(state, redirectUri):string`; `createUserSession(userId):Promise<void>`(jose HS256, typ:'user', 만료 30일, 쿠키 'limfruits_user' httpOnly·secure(prod)·sameSite lax); `getUserSession():Promise<{userId}|null>`; `clearUserSession()`. **lib/auth.ts(admin) 수정 금지 — 별도 파일**. 유저/관리자 세션 완전 분리(쿠키명·claim 다름)
- `GET /api/auth/kakao`: kakaoConfigured 아니면 503. **state(CSRF) 생성→httpOnly 쿠키 'limfruits_oauth_state'**, 카카오 authorize로 redirect. return_to(내부경로 '/' 시작만) 허용
- `GET /api/auth/kakao/callback`: **state 쿠키 일치 검증(CSRF)**, code→token 교환(kauth.kakao.com/oauth/token), user/me(kapi.kakao.com/v2/user/me)→kakaoId·nickname, upsert user(getUserByKakaoId 없으면 createUser), createUserSession, **내부경로로만 redirect(오픈리다이렉트 방지, 기본 /my)**. 실패 시 /login?error=. 카카오 토큰은 서버에서만 사용, 클라이언트·DB 저장 금지
- `POST /api/auth/logout`: 세션 쿠키 삭제 → '/'

## 화면 (storefront 소유)
- `components/site/Header.tsx`(server 로 세션·config 읽어 전달): kakaoConfigured && 세션없음 → "로그인"(→/api/auth/kakao); 세션있음 → "마이페이지"(→/my). 키 없으면 로그인/마이 미노출(기존 홈·주문조회 유지)
- `app/(site)/my/page.tsx`(server): 세션 없으면 로그인 안내(카카오 버튼)·또는 로그인 유도. 있으면 닉네임 + **내 주문 목록**(listOrdersByUser) — 주문번호·날짜·상품요약·상태·금액·(선물이면 배송건 수)·운송장, 배송 상태 타임라인, 로그아웃 버튼. **본인 userId 주문만**(전화 재인증 없이 표시 — 로그인으로 인증됨). 비회원 주문(userId null)은 안 보임
- `app/(site)/login/page.tsx`(선택): 카카오 로그인 버튼 페이지. BRAND v2

## 결제 연동 (checkout 소유)
- `app/api/orders/route.ts`, `app/api/orders/gift/route.ts`: 세션 있으면 userId 를 create 에 첨부(없으면 null). **금액·기존 검증 로직 불변**
- OrderForm/gift: 로그인 상태면 주문자 성함을 닉네임으로 프리필(선택, 수정 가능). 과하지 않게

## 보안·주의
- OAuth state(CSRF) 필수, 세션 쿠키 httpOnly·secure(prod)·sameSite lax, 카카오 토큰 미노출, 리다이렉트 내부경로만, /my 는 본인 주문만. 유저↔관리자 세션 분리. lib/auth.ts·toss.ts·order-token.ts·결제 성공/실패 페이지 수정 금지. 결제 금액·승인 불변. 키 없는 환경에서 빌드·전 경로 정상(로그인 미노출)

## 파일 소유권 (v2.8)
| 에이전트 | 소유 |
|---|---|
| data | `lib/types.ts`, `lib/db.ts`, `lib/db-memory.ts`, `lib/db-supabase.ts`, `supabase/schema.sql` |
| auth | `lib/user-auth.ts`(신규), `app/api/auth/**`(신규) |
| storefront | `app/(site)/my/**`(신규), `app/(site)/login/**`(신규), `components/site/Header.tsx`, `components/auth/*`(신규) |
| checkout | `app/api/orders/route.ts`, `app/api/orders/gift/route.ts`, `components/order/OrderForm.tsx`, `components/order/gift/*` |
그 외 읽기 전용. 결제·리뷰·챗봇·선물주문·팝업 로직 변경 금지.

---

# v2.9 부록 — 쿠폰·포인트 (회원제 Phase 3.0)

첫 구매 쿠폰(가입 시 발급) + 포인트 적립·사용. **회원(카카오 로그인) 전용**, 비회원 주문은 그대로.
쿠폰·포인트는 **단일(SINGLE) 주문**에만 적용(선물/대량 주문은 v1 제외).

## 확정 규칙 (기본값)
- **첫 구매 쿠폰**: 가입 시 1회 발급. 3,000원 할인 · 30,000원 이상 주문 시 · 발급 후 90일.
- **적립**: 구매 결제액의 1%(원 단위 내림) — 결제완료(markPaid) 시 지급. 포토리뷰(사진 1장 이상) 1,000P.
- **사용**: 결제 시 쿠폰·포인트 차감. 포인트로 결제금액이 `MIN_PAYABLE_AMOUNT(1,000원)` 밑으로 내려갈 수 없음.
- **1년 소멸**: 적립분에 `expires_at`(now+365일) 기록. 자동 소멸 배치는 **Phase 3.1**(초기엔 잔액이 미미).

## 보안 모델 (기존 결제모델 유지)
- 할인은 **서버가 `lib/coupon-points.ts:resolveBenefits()` 로만 계산** → `order.totalAmount`(최종 결제금액)에 반영.
  클라이언트가 보낸 `couponId`/`pointsToUse` 는 **요청일 뿐** 실제 할인은 서버가 재검증·재계산.
- `/order/success` 는 기존대로 `order.totalAmount == 리다이렉트 amount` 검증 후 그 금액으로 토스 승인. **불변**.
- 쿠폰 소유자 확인: `coupon.userId === session.userId`. 비회원(userId=null)은 쿠폰·포인트 불가.

## 예약·정산 생명주기
- **주문 생성(createOrder)**: 쿠폰 예약(`ISSUED→USED`, 조건부 전환) + 포인트 차감(낙관적 잠금 + `SPEND` 원장).
  실패 시 롤백(쿠폰 되돌림·주문 삭제) → `BenefitReservationError`(API 409).
- **결제완료(markPaid)**: `PENDING→PAID` 조건부 전환(멱등) 후에만 적립 지급(`EARN_PURCHASE`, expires_at=+1년).
- **취소(cancelOrder)**: 완전 멱등. 쿠폰 반환 + 포인트 환불(`REFUND`) + **원장 실적 기준** 적립 회수
  (`REVOKE` = 이 주문의 EARN_PURCHASE+EARN_REVIEW 합계, 잔액 음수 허용 네팅). 관리자 취소(PATCH status=CANCELED)가 이 경로를 탄다.
- **원자성**: 포인트 잔액±원장은 Postgres 함수 `adjust_points`(멱등)·`spend_points`(잔액확인+차감)로 한 트랜잭션 처리.
  `point_transactions(order_no, reason)` 부분 unique 인덱스로 사유별 1회 멱등. `REVOKE`(취소회수)와 `EXPIRE`(3.1 만료소멸) 분리.
  markPaid 적립 실패는 결제 완료를 막지 않는다(부가 혜택 — 로깅 후 진행).
- **방치 반환(releaseStalePendingBenefits)**: 30분 경과 PENDING 주문의 쿠폰·포인트를 새 주문 생성 전 반환(재시도 가능).

## 데이터 (data 소유) — `supabase/schema.sql` v2.9 절
- `users.points`(잔액), `coupons`(user_id·discount·min·status·used_order_no·expires_at, unique(user_id,name)),
  `point_transactions`(delta·reason·order_no·expires_at), `orders`에 coupon_id·coupon_discount·points_used·points_earned.
- 메모리 스토어 키 `V2_8→V2_9`. 기존 설치는 v2.9 절만 다시 실행(전부 멱등).

## 화면
- **체크아웃**(`components/order/OrderForm.tsx`): 로그인 회원에 쿠폰 체크박스 + 포인트 입력(최대 사용 한도·전액 버튼),
  합계에 할인 내역·적립 예정 표시. 비회원엔 로그인 안내. `app/(site)/order/page.tsx`가 쿠폰·잔액을 서버조회해 전달.
- **마이페이지**(`app/(site)/my/page.tsx`): 포인트 잔액·쿠폰함·포인트 내역.
- **랜딩 배너**(`components/promo/SignupCouponBanner.tsx`): 비회원에게 가입 쿠폰 안내(홈 상단).
- **관리자 주문상세**: 쿠폰·포인트 차감/적립 내역 표시(별도 탭 없음 — 엘더 모바일 4탭 유지, 쿠폰 대시보드는 3.1).
- **가입 발급**: 카카오 콜백 신규 유저 생성 시 `issueSignupCoupon`(발급 실패는 로그인 막지 않음).

## 파일 소유권 (v2.9)
| 에이전트 | 소유 |
|---|---|
| data | `lib/types.ts`, `lib/db.ts`, `lib/db-memory.ts`, `lib/db-supabase.ts`, `lib/coupon-points.ts`(신규), `supabase/schema.sql` |
| checkout | `app/api/orders/route.ts`, `components/order/OrderForm.tsx`, `app/(site)/order/page.tsx` |
| rewards | `app/api/reviews/route.ts`(적립 훅), `app/api/auth/kakao/callback/route.ts`(발급 훅), `app/api/admin/orders/[orderNo]/route.ts`(취소→cancelOrder) |
| storefront | `app/(site)/my/page.tsx`, `app/(site)/page.tsx`(배너), `components/promo/SignupCouponBanner.tsx`(신규), `app/admin/(dashboard)/orders/[orderNo]/page.tsx` |
그 외 읽기 전용. **결제 금액·토스 승인 로직·성공/실패 페이지·lib/toss.ts·lib/auth.ts 변경 금지.**

## 제약·주의
- 선물/대량 주문은 쿠폰·포인트 미적용(v1). 포인트 자동소멸 배치 미구현(3.1). 만료일자는 지금부터 기록.
- 키 없는 환경(카카오 미설정)에서 전 경로 정상 — 쿠폰·포인트 UI·배너는 미로그인/미설정 시 미노출.
