# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 문서 지도

- `README.md` — 설치·연동(토스/Supabase/카카오/챗봇/문자) 설정과 관리자 사용법. 환경변수 전체 목록은 여기 있다(`.env.example`은 일부만).
- `SPEC.md` — 설계 계약서. v2 본문 + 기능별 부록(v2.1 상세 블록 ~ v2.9 쿠폰·포인트). 인터페이스·경로·이름은 여기 정의를 따른다. 단 "Next.js 15" 표기는 낡았고(실제 16.2), "파일 소유권" 표는 과거 병렬 에이전트 라운드용이다.
- `BRAND.md` — 디자인 토큰·카피 톤(v2 프로페셔널 미니멀).
- `PLACEHOLDERS.md` — 오픈 전 실제 정보로 바꿀 항목. 미확정 정보를 코드에 넣으면 여기에 기록한다.

## 명령어

```bash
npm run dev                                           # localhost:3000
SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= npm run dev  # 인메모리 데모 모드 강제 (.env.local 값을 덮어씀)
npx tsc --noEmit                                      # 타입체크
npm run lint                                          # ESLint 9 flat config
npm run build
```

- 테스트 프레임워크는 없다. 검증 = 타입체크 + lint + 빌드 + 데모 모드에서 실제 흐름 확인.
- Next 16의 `next build`는 lint를 돌리지 않는다. 2026-10 기준 lint에 기존 에러 4건이 있다(`react-hooks/purity` — `my/page`, `admin/(dashboard)/members/page`, `OrderForm` / `react-hooks/set-state-in-effect` — `PromoPopup`). 새 에러만 만들지 않으면 된다.
- **현재 `.env.local`은 라이브 Supabase를 가리킨다.** 그냥 `npm run dev`로 주문·리뷰·상품 수정을 하면 실데이터에 기록된다. 실험은 위의 데모 모드로 한다.
- 이 코드베이스가 이미 쓰는 Next 16 차이: `proxy.ts`(구 `middleware.ts`), `params`·`searchParams`·`cookies()`는 Promise라 await 필요, `next lint` 제거.

## 아키텍처

### 저장소 추상화 — `lib/db.ts`
모든 데이터 접근은 `getStore()`가 돌려주는 `Store` 인터페이스를 거친다. `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 둘 다 있으면 `db-supabase.ts`, 아니면 `db-memory.ts`(시드 상품 4·옵션 18·예시 주문 2, 서버 재시작 시 초기화).
- Store 변경 = `lib/types.ts` + 두 구현 모두 + `supabase/schema.sql`. 메모리 스토어는 globalThis 싱글턴 키(`__limfruitsMemoryDbV2_9`)를 올려야 HMR 중 구 스키마 객체 때문에 죽지 않는다. 시드는 `db-memory.ts`와 `schema.sql`을 동일하게 유지한다.
- Supabase 테이블은 RLS on + 정책 없음 → 서비스 롤 키로 서버에서만 접근한다. 브라우저는 Supabase를 직접 부르지 않고, 공개 GET API 대신 서버 컴포넌트가 store를 직접 읽는다. snake_case 행 ↔ camelCase 타입 매핑은 `db-supabase.ts`에 있다.
- Storage(`lib/storage.ts`)는 REST 직접 호출이며 `apikey` 헤더로 인증한다(`Authorization: Bearer`는 sb_secret 키를 거부).

### 결제(토스 결제위젯 v2) — 금액은 항상 서버가 정한다
1. `POST /api/orders`(선물은 `/api/orders/gift`): DB 옵션가로 금액을 계산하고, 쿠폰·포인트는 `lib/coupon-points.ts`의 `resolveBenefits()`로만 계산 → PENDING 주문 저장 → `{ orderNo, amount, orderName }` 반환.
2. 클라이언트가 위젯 `requestPayment` → successUrl `/order/success`(서버 컴포넌트): 쿼리 amount를 DB `totalAmount`와 대조, 생성 후 30분 TTL, 품절·비노출 재확인, DB 금액으로 `confirmPayment`, `ALREADY_PROCESSED_PAYMENT`는 `getPayment`로 재검증 → `markPaid`.
3. `/order/complete/[orderNo]?t=` — `lib/order-token.ts`의 1시간 HMAC 토큰이 있어야 상세를 보여 준다. 없으면 최소 정보 + 주문조회 유도.
- `/order/fail`은 코드만 받고 문구는 `friendlyTossMessage()` 화이트리스트에서 고른다(URL 자유 텍스트 렌더 금지).
- 관리자 취소 `PATCH /api/admin/orders/[orderNo]` → `cancelPayment` + `store.cancelOrder()`(쿠폰 반환·포인트 환불·적립 회수, 멱등).
- `lib/toss.ts`·`lib/order-token.ts`·`lib/auth.ts`·`order/success`·`order/fail`은 SPEC 부록마다 "수정 금지"로 지정된 결제 코어다. 건드려야 하면 AGENTS.md의 위험 변경 절차를 따른다.

### 쿠폰·포인트(v2.9) — 로그인 회원의 SINGLE 주문만
- 주문 생성 시 쿠폰 예약 + 포인트 차감, 실패하면 롤백 후 `BenefitReservationError`(409). 적립은 `markPaid` 이후이며, 적립 실패가 결제 완료를 막지 않는다.
- 포인트 원자성은 Postgres 함수 `adjust_points`·`spend_points` + `point_transactions(order_no, reason)` 부분 unique 인덱스(사유별 1회 멱등)가 보장한다. 잔액 = 원장 합.
- `STALE_PENDING_MS`(60분)는 승인 TTL(30분)보다 커야 한다. 승인 가능한 주문의 혜택을 먼저 반환해 버리는 경합을 막기 위해서다.

### 주문 모델
`Order.kind`는 `SINGLE` | `GIFT`. GIFT는 top-level `customerName`/`phone`이 보내는 분이고 top-level 주소는 빈 문자열이며, 받는 분별 배송지·운송장은 `shipments[]`에만 있다. top-level `items`는 모든 배송 건을 평탄화한 것. 로젠 엑셀 왕복의 배송건번호는 SINGLE = `orderNo`, GIFT = `orderNo#n`.

### 인증 — 세 갈래, 서로 분리
- 관리자: 비밀번호 하나 → jose JWT 쿠키 `limfruits_admin`(7일). `proxy.ts`는 `/admin/:path*` 페이지만 가드하고 API는 커버하지 않는다 → **`app/api/admin/**` 핸들러는 전부 `requireAdmin()`을 직접 호출**해야 한다.
- 회원(카카오): `lib/user-auth.ts`, 쿠키 `limfruits_user`(30일). OAuth state로 CSRF 검증, 리다이렉트는 `safeInternalPath()`로 내부 경로만 허용.
- 비회원: 주문번호+전화번호(`findOrder`) 또는 이름+연락처(`findOrdersByPhoneName`)로 조회·리뷰 작성.
- `AUTH_SECRET`·`ADMIN_PASSWORD`가 없으면 `next dev`에서만 폴백하고, 프로덕션에서는 fail-closed.

### env 게이트 — 키가 없으면 그 기능의 UI가 사라지고 나머지는 정상 동작
`ANTHROPIC_API_KEY`(챗봇), `KAKAO_REST_API_KEY`(로그인·마이페이지 — 켜지면 Header가 `cookies()`를 읽어 손님 페이지 전체가 동적 렌더), `ALIGO_*`(신규 주문 문자, 없으면 드라이런 로그), 토스 키(없으면 문서 공개 테스트 키로 폴백). 새 외부 연동도 이 패턴을 따른다.

### 화면 구성
- `app/(site)` — 손님용. 레이아웃이 Header/Footer·챗봇·입장 팝업을 붙이며 `getPromo()`로 DB를 읽는다.
- `app/admin` — 부모님용. 자체 nav만 쓰고 Header/Footer가 없다. 로그인 후 화면은 `(dashboard)` 그룹.
- 상품 상세는 `Product.blocks: DetailBlock[]`(jsonb) 카드뉴스 블록. 검증은 `app/api/admin/products/detail-blocks.ts`의 `sanitizeDetailBlocks()`(Supabase 읽기에서도 재사용). 렌더러 `components/product/DetailBlocks.tsx`는 `<img>`(임의 도메인 허용)에 `https://`·`/` URL만 쓰고 `dangerouslySetInnerHTML`을 쓰지 않는다. blocks가 비면 `detail` 텍스트로 폴백.
- 신규 주문 문자: Supabase pg_cron(`supabase/cron.sql`)이 4시간마다 `/api/cron/notify-orders`를 `CRON_SECRET`으로 호출한다.

## DB 스키마 변경
`supabase/schema.sql` 한 파일에 버전별 절로 쌓고, 모든 문장이 멱등이다(`if not exists`, `create or replace`). 새 변경도 멱등 절로 추가하고 README에 "기존 설치는 이 절만 실행" 안내를 남긴다. 컬럼이 아직 없는 DB에서도 버티도록 읽기는 방어적으로 한다(예: `kind`가 null이면 `'SINGLE'`). 적용 순서는 AGENTS.md를 따른다.

## 컨벤션
- 외부 UI 라이브러리 없이 Tailwind v4만 쓴다. 색은 `app/globals.css`의 BRAND 토큰(`--color-brand` 등), 공용 UI는 `components/ui/*`(prop API 유지).
- UI 텍스트·에러 메시지는 전부 한국어 존댓말. 카피는 BRAND.md를 따른다(감성 서사·느낌표·이모지 금지).
- 관리자 화면 사용자는 휴대폰을 쓰는 장년층(부모님) → 큰 글씨, 44px 이상 터치 타깃.
- 금액은 원 단위 정수이고 옵션 가격은 배송비 포함가다.
- 사업자 정보·인증·당도 같은 사실은 지어내지 않는다. 확정 값은 SPEC v2.7 부록, 미확정 값은 PLACEHOLDERS.md.

## 장애 대응
DB를 읽는 페이지(`/`, 상품 상세)만 500이고 `/admin/login`·`/robots.txt`가 정상이면 Supabase부터 의심한다. 무료 플랜은 7일간 활동이 적으면 프로젝트를 일시정지하고, 그러면 `<ref>.supabase.co`가 NXDOMAIN이 된다(`dig`로 확인 → 대시보드에서 Resume, 일시정지 90일이 지나면 대시보드 복구 불가). 프로덕션 주소는 `https://limfruits.co.kr`(DNS는 Vercel 네임서버, `www`는 308로 이동)이다. 로컬 저장소는 Vercel에 link돼 있지 않으니 배포 상태는 `vercel inspect limfruits.co.kr --scope limfruits`·`vercel ls limfruits`로 본다.
