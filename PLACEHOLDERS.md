# 실제 정보로 교체해야 하는 것들

사이트를 실제로 열기 전에 아래 항목을 실제 정보로 바꿔주세요. (괄호 안은 코드 위치)

## 사업자·연락처 정보

- [ ] 푸터 상호 "풍천대봉감농원" 확인 — 사용자의 옛 스마트스토어 상세페이지에서 가져온 값. 사업자등록 상호와 일치하는지 확인 필요 (`components/site/Footer.tsx`)
- [ ] 푸터 농장 주소 "전라남도 나주시 덕룡로 33-8" 확인 — 사용자의 옛 스마트스토어 상세페이지에서 가져온 값. 현재 사업장·발송지 주소가 맞는지 확인 필요 (`components/site/Footer.tsx`. 상세 블록 시드의 생산지 문단 — `lib/db-memory.ts`·`supabase/schema.sql` — 에도 같은 주소가 들어 있음)
- [ ] 대표자명 — `components/site/Footer.tsx`의 "(대표 OOO)"
- [ ] 사업자등록번호 — `components/site/Footer.tsx`의 "OOO-OO-OOOOO"
- [ ] 통신판매업 신고번호 — `components/site/Footer.tsx`의 "제OOOO-전남나주-OOOO호"
- [ ] 고객센터 전화번호 — 3곳: `components/site/Footer.tsx`, `app/(site)/page.tsx`(구매 안내 "문의" 열), `app/(site)/products/[id]/page.tsx`(문의 섹션). 표시 텍스트 "010-OOOO-OOOO"와 `tel:010-0000-0000` 링크 모두

## 상품·사진·문구

- [ ] 상품 옵션 실제 구성·가격 — 현재 시드값(19,000 / 27,000 / 35,000 / 45,000원)은 시세 참고용 placeholder. 데모 시드는 `lib/db-memory.ts`, Supabase 시드는 `supabase/schema.sql`. 운영 중 가격 변경은 관리자 `/admin/products`에서
- [ ] 옵션 설명의 과수 규격 — "O~O과"는 확인 전 placeholder (위 시드 2곳 동일). 상세 블록 "상품 구성" 표의 "O~O과"와 같은 값으로 함께 교체
- [ ] 상품 상세 본문 시드 — 재배·구성·보관 안내를 일반 문구로 넣어 둠 (`lib/db-memory.ts`의 `NAJU_PEAR_DETAIL`, `supabase/schema.sql` 시드 동일). 실제 농장 사실에 맞게 확인·수정. 운영 중 수정은 관리자 `/admin/products`의 "상세 소개"에서
- [ ] 상품 대표 사진 — 상품 `imageUrl`이 비어 있으면 홈 카드·상품 상세에 로고 일러스트 placeholder가 표시됨. 실제 상품 사진 URL을 관리자 `/admin/products`에서 등록
- [ ] 나주배 품종명 — 확인이 안 돼 시드 어디에도 품종명(신고 등)을 쓰지 않음. 확인되면 관리자 `/admin/products`의 상세페이지 구성(제목·문단 블록)이나 한 줄 소개에 추가
- [ ] 상세 블록 시드의 당도 실측값 — "당도 관리" 포인트의 "OO brix"는 확인 전 placeholder (`lib/db-memory.ts`의 `NAJU_PEAR_BLOCKS`, `supabase/schema.sql` 시드 동일). 실제 기준 당도로 교체
- [ ] 상세 블록 시드의 과수 실측값 — "상품 구성" 표의 "O~O과"는 확인 전 placeholder (위 시드 2곳 동일). 옵션별 실제 과수로 교체
- [ ] 상세 사진 — 시드에는 사진(image) 블록을 넣지 않음. 실제 상품·농장 사진이 준비되면 관리자 `/admin/products`의 상세페이지 구성에서 사진 블록을 추가하고 이미지 URL 입력
- [ ] GAP·로컬푸드 인증을 배에도 표기할지 확인 후 badge 블록 추가 — 인증이 배 상품에 해당하는지 미확인이라 시드에 넣지 않음. 확인되면 관리자 상세페이지 구성에서 "인증 배지" 블록 추가
- [ ] 배송 정책 문구 (발송 소요일, 이용 택배사) — 확정된 정책이 없어 `app/(site)/order/complete/[orderNo]/page.tsx`, `app/(site)/products/[id]/page.tsx`(배송 안내), `app/(site)/page.tsx`(구매 안내)에는 "주문 순서대로 발송" 수준의 일반 문구만 넣어 둠. 실제 정책 확정 시 교체

## 연동 키·환경변수 (설정 방법은 README.md 참고)

- [ ] 토스페이먼츠 라이브 키 — 현재는 문서 공개 테스트 키 폴백 (`components/order/OrderForm.tsx`의 클라이언트 키, `lib/toss.ts`의 시크릿 키). 상점 심사 후 `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` 설정
- [ ] Supabase 연동 — 미설정 시 인메모리 데모 모드(서버 재시작 시 주문 소실). `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 설정
- [ ] `ADMIN_PASSWORD` — 미설정 시 데모 기본값 `limfruits`. 운영에서는 반드시 다른 값으로 설정
- [ ] `AUTH_SECRET` — 32자 이상 랜덤 문자열. 미설정 시 개발용 폴백을 쓰며 경고가 출력됨 (운영 금지)
- [ ] `NEXT_PUBLIC_SITE_URL` — 배포 주소 (카톡 등 공유 미리보기 OG 이미지의 절대경로용)
