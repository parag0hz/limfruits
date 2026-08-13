import { NextResponse, type NextRequest } from 'next/server';
import {
  getKakaoAuthUrl,
  getKakaoRedirectUri,
  kakaoConfigured,
  setOAuthTx,
} from '@/lib/user-auth';

export const runtime = 'nodejs';

/**
 * GET /api/auth/kakao — 카카오 로그인 시작.
 * - KAKAO_REST_API_KEY 없으면 503 (안전모드: 로그인 자체를 켜지 않음).
 * - CSRF 방지용 state 를 생성해 httpOnly 쿠키로 저장하고 카카오 인가 페이지로 리다이렉트.
 * - `?return_to=` 는 내부 경로('/'로 시작)만 허용 — 로그인 후 그 경로로 복귀(오픈 리다이렉트 방지).
 */
export async function GET(request: NextRequest) {
  if (!kakaoConfigured()) {
    return NextResponse.json(
      { error: '로그인 기능을 준비 중입니다.' },
      { status: 503 }
    );
  }

  const returnTo = request.nextUrl.searchParams.get('return_to');
  const state = crypto.randomUUID();
  await setOAuthTx(state, returnTo);

  const redirectUri = getKakaoRedirectUri(request.url);
  return NextResponse.redirect(getKakaoAuthUrl(state, redirectUri));
}
