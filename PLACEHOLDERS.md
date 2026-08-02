# 실제 정보로 교체해야 하는 것들

사이트를 실제로 열기 전에 아래 항목을 실제 정보로 바꿔주세요. (괄호 안은 코드 위치)

## 사업자·연락처 정보

- [ ] 상호명 / 대표자명 — `components/site/Footer.tsx`의 "OOO농원 (대표 OOO)"
- [ ] 사업자등록번호 — `components/site/Footer.tsx`의 "OOO-OO-OOOOO"
- [ ] 통신판매업 신고번호 — `components/site/Footer.tsx`의 "제OOOO-전남나주-OOOO호"
- [ ] 고객센터 전화번호 — 2곳: `components/site/Footer.tsx`, `components/home/PurchaseInfo.tsx` (표시 텍스트 "010-OOOO-OOOO"와 `tel:010-0000-0000` 링크 모두. PurchaseInfo의 "실제 연락처로 교체 예정" 안내 문구도 삭제)
- [ ] 농장 주소 — `components/site/Footer.tsx`의 "전라남도 나주시 OOO읍 OOO길 OO"

## 상품·사진·문구

- [ ] 상품 옵션 실제 구성·가격 — 현재 시드값(19,000 / 27,000 / 35,000 / 45,000원)은 시세 참고용 placeholder. 데모 시드는 `lib/db-memory.ts`, Supabase 시드는 `supabase/schema.sql`. 운영 중 가격 변경은 관리자 `/admin/products`에서
- [ ] 옵션 설명의 과수 규격 — "5~7과" 등은 임의값 (위 시드 2곳 동일)
- [ ] 농장 사진 2장 — `components/home/FarmStory.tsx`의 "사진 준비 중" placeholder (농장 전경 / 배 수확 모습)
- [ ] 배송 정책 문구 (발송 소요일, 이용 택배사) — 확정된 정책이 없어 `app/(site)/order/complete/[orderNo]/page.tsx`와 `components/home/PurchaseInfo.tsx`에는 "순차 발송" 수준의 일반 문구만 넣어 둠. 실제 정책 확정 시 교체

## 연동 키·환경변수 (설정 방법은 README.md 참고)

- [ ] 토스페이먼츠 라이브 키 — 현재는 문서 공개 테스트 키 폴백 (`components/order/OrderForm.tsx`의 클라이언트 키, `lib/toss.ts`의 시크릿 키). 상점 심사 후 `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` 설정
- [ ] Supabase 연동 — 미설정 시 인메모리 데모 모드(서버 재시작 시 주문 소실). `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 설정
- [ ] `ADMIN_PASSWORD` — 미설정 시 데모 기본값 `limfruits`. 운영에서는 반드시 다른 값으로 설정
- [ ] `AUTH_SECRET` — 32자 이상 랜덤 문자열. 미설정 시 개발용 폴백을 쓰며 경고가 출력됨 (운영 금지)
- [ ] `NEXT_PUBLIC_SITE_URL` — 배포 주소 (카톡 등 공유 미리보기 OG 이미지의 절대경로용)
