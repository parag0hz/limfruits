import { NextResponse, type NextRequest } from 'next/server';
import {
  consumeOAuthTx,
  createUserSession,
  getKakaoRedirectUri,
  kakaoConfigured,
} from '@/lib/user-auth';
import { getStore } from '@/lib/db';

export const runtime = 'nodejs';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_URL = 'https://kapi.kakao.com/v2/user/me';

/** 실패 시 로그인 페이지로 복귀(사유 코드는 화면용 힌트만, 카카오 원문 에러 미노출) */
function loginError(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
}

/**
 * GET /api/auth/kakao/callback — 카카오 인가 콜백.
 * ① state 쿠키 일치(CSRF) ② code→token 교환 ③ user/me 조회 ④ user upsert ⑤ 세션 발급.
 * 성공 시 내부 경로(기본 /my)로만 리다이렉트(오픈 리다이렉트 방지). 실패 시 /login?error=.
 * 카카오 액세스 토큰은 서버에서만 사용하고 클라이언트·DB 에 저장하지 않는다.
 */
export async function GET(request: NextRequest) {
  if (!kakaoConfigured()) {
    return loginError(request, 'config');
  }

  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const returnedState = params.get('state');
  const kakaoError = params.get('error');

  // 사용자가 동의를 취소했거나 카카오가 에러를 돌려준 경우 — tx 쿠키를 정리하고 종료
  if (kakaoError || !code) {
    await consumeOAuthTx(returnedState);
    return loginError(request, 'denied');
  }

  // CSRF: state 쿠키와 일치해야 진행 (tx 쿠키는 여기서 1회용으로 소비·삭제)
  const { ok, returnTo } = await consumeOAuthTx(returnedState);
  if (!ok) {
    return loginError(request, 'state');
  }

  const redirectUri = getKakaoRedirectUri(request.url);

  try {
    // ① code → access_token 교환
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY ?? '',
      redirect_uri: redirectUri,
      code,
    });
    const clientSecret = process.env.KAKAO_CLIENT_SECRET;
    if (clientSecret) tokenBody.set('client_secret', clientSecret);

    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: tokenBody.toString(),
      cache: 'no-store',
    });
    if (!tokenRes.ok) {
      return loginError(request, 'token');
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: unknown };
    const accessToken = tokenJson.access_token;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      return loginError(request, 'token');
    }

    // ② 사용자 정보 조회 → kakaoId·nickname (토큰은 이 요청에만 사용, 저장하지 않음)
    const meRes = await fetch(KAKAO_USER_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!meRes.ok) {
      return loginError(request, 'profile');
    }
    const me = (await meRes.json()) as {
      id?: number | string;
      properties?: { nickname?: unknown } | null;
      kakao_account?: { profile?: { nickname?: unknown } | null } | null;
    };
    if (me.id === undefined || me.id === null) {
      return loginError(request, 'profile');
    }
    const kakaoId = String(me.id);
    const rawNickname =
      me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? '';
    const nickname =
      typeof rawNickname === 'string' ? rawNickname.slice(0, 100) : '';

    // ③ user upsert (있으면 재사용, 없으면 생성)
    const store = getStore();
    let user = await store.getUserByKakaoId(kakaoId);
    if (!user) {
      user = await store.createUser({ kakaoId, nickname });
      // v2.9 — 신규 가입 시 첫 구매 쿠폰 1회 발급. 발급 실패는 로그인 자체를
      // 막지 않는다(쿠폰은 부가 혜택 — 로그인 성공이 우선). 중복이면 null.
      try {
        await store.issueSignupCoupon(user.id);
      } catch (couponErr) {
        console.error('[limfruits] 가입 쿠폰 발급 실패(로그인은 계속):', couponErr);
      }
    }

    // ④ 세션 발급 후 내부 경로로만 복귀
    await createUserSession(user.id);
    return NextResponse.redirect(new URL(returnTo, request.url));
  } catch {
    return loginError(request, 'server');
  }
}
