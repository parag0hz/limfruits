<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git & 배포 워크플로우

`main` 은 Vercel 자동배포 = **라이브 매출 사이트**다. 정식 Git Flow는 쓰지 않는다(1인 개발).

- **안전한 변경**(문구·UI·사진·소소한 수정) → `main` 직접 커밋·push.
- **위험한 변경**(결제/토스, DB 마이그레이션, 쿠폰·포인트 등 금전, 인증) → **feature 브랜치 → push → Vercel 프리뷰에서 검증 → `main` 머지**. 프로덕션 보호 목적(GitHub Flow).
- **DB 마이그레이션은 항상 SQL 먼저 실행 → 컬럼/함수 존재 확인 → 그다음 코드 배포.** 절대 컬럼 없이 push 하지 않는다.
- 롤백: Vercel 이전 배포 승격 또는 `git revert`.
