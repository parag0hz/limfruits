import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

/**
 * v2.8 유저(카카오 소셜 로그인) 세션 유틸.
 * 관리자 세션(lib/auth.ts)과 **완전히 분리**된다 — 쿠키 이름·JWT claim(typ)이 다르다.
 * lib/auth.ts 는 읽기만 하고 수정하지 않는다.
 */

/** 유저 세션 쿠키 이름 — 관리자(limfruits_admin)와 분리 */
export const USER_COOKIE = 'limfruits_user';

/** 유저 세션 유효기간: 30일 (초) */
export const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** OAuth 왕복(CSRF state / return_to)용 1회성 쿠키 — 로그인 진행 중에만 유지 */
const OAUTH_STATE_COOKIE = 'limfruits_oauth_state';
const OAUTH_RETURN_COOKIE = 'limfruits_oauth_return';
const OAUTH_TX_MAX_AGE = 60 * 10; // 10분

/**
 * AUTH_SECRET 미설정 시 `next dev` 한정 폴백 (관리자 lib/auth.ts 와 동일 방침, 별도 상수).
 * 프로덕션에서 미설정이면 폴백 없이 throw(fail-closed) — 유저 세션 위조 방지.
 * 유저·관리자는 쿠키·claim 이 다르므로 시크릿을 공유해도 세션은 서로 섞이지 않는다.
 */
const DEV_FALLBACK_SECRET =
  'limfruits-dev-only-user-fallback-secret-change-me-in-production';

let warnedFallback = false;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error(
        '[limfruits] AUTH_SECRET이 설정되지 않았습니다. 프로덕션에서는 AUTH_SECRET(32자 이상 랜덤)을 반드시 설정해야 로그인 기능을 사용할 수 있습니다.'
      );
    }
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn(
        '[limfruits] AUTH_SECRET이 설정되지 않아 개발용 폴백 시크릿으로 유저 세션을 서명합니다. 프로덕션에서는 반드시 AUTH_SECRET(32자 이상 랜덤)을 설정하세요.'
      );
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(secret);
}

/** 카카오 REST API 키가 설정되어 로그인 기능을 켤 수 있는지 (없으면 안전모드: 로그인 미노출) */
export function kakaoConfigured(): boolean {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}

/**
 * redirect_uri — NEXT_PUBLIC_SITE_URL 우선, 없으면 요청 origin 기준으로 유도.
 * authorize 요청과 token 교환에서 **정확히 동일한 값**이어야 하므로 한 곳에서 계산한다.
 * (카카오 개발자 콘솔에 이 redirect_uri 를 등록해야 함)
 */
export function getKakaoRedirectUri(requestUrl: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (base) return `${base}/api/auth/kakao/callback`;
  return new URL('/api/auth/kakao/callback', requestUrl).toString();
}

/** 카카오 인가 요청 URL (OAuth2 authorization_code 표준) */
export function getKakaoAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.KAKAO_REST_API_KEY ?? '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'profile_nickname', // 닉네임 조회를 위한 동의 항목
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

/**
 * 내부 경로만 허용 — 오픈 리다이렉트 방지.
 * '/' 로 시작하되 '//'(프로토콜 상대)·백슬래시 우회·제어문자는 거부하고 fallback 반환.
 */
export function safeInternalPath(
  path: string | null | undefined,
  fallback = '/my'
): string {
  if (!path) return fallback;
  if (!path.startsWith('/')) return fallback;
  if (path.startsWith('//') || path.startsWith('/\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\\]/.test(path)) return fallback;
  return path;
}

/** 유저 세션 발급 — jose HS256, typ:'user', 만료 30일, 쿠키 limfruits_user(httpOnly·secure(prod)·lax) */
export async function createUserSession(userId: string): Promise<void> {
  const token = await new SignJWT({ typ: 'user', userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${USER_SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: USER_SESSION_MAX_AGE,
  });
}

/**
 * 현재 요청의 유저 세션 — 유효하면 { userId }, 아니면 null.
 * server component / route handler 전용. 어떤 경우에도 throw 하지 않는다
 * (쿠키 없음·서명 오류·시크릿 미설정 모두 미인증으로 취급 → 키 없는 환경에서도 전 경로 정상).
 */
export async function getUserSession(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(USER_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    });
    if (payload.typ !== 'user') return null; // 관리자 토큰 등 다른 claim 은 거부
    const userId = payload.userId;
    if (typeof userId !== 'string' || userId.length === 0) return null;
    return { userId };
  } catch {
    return null;
  }
}

/** 유저 세션 삭제(로그아웃) */
export async function clearUserSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function txCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: OAUTH_TX_MAX_AGE,
  };
}

/**
 * OAuth 왕복 시작 — CSRF state 쿠키(+선택 return_to)를 심는다.
 * return_to 는 내부 경로만 저장한다(오픈 리다이렉트 방지).
 */
export async function setOAuthTx(
  state: string,
  returnTo?: string | null
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, txCookieOptions());
  const safe = returnTo ? safeInternalPath(returnTo, '') : '';
  if (safe) {
    cookieStore.set(OAUTH_RETURN_COOKIE, safe, txCookieOptions());
  } else {
    // 이전 왕복의 잔여 return_to 가 남지 않도록 정리
    cookieStore.set(OAUTH_RETURN_COOKIE, '', { ...txCookieOptions(), maxAge: 0 });
  }
}

/**
 * 콜백에서 state 를 검증하고 return_to 를 회수한다.
 * tx 쿠키는 1회용이므로 성공/실패와 무관하게 항상 삭제한다.
 * @returns ok: state 일치 여부(CSRF), returnTo: 로그인 후 복귀할 내부 경로(기본 /my)
 */
export async function consumeOAuthTx(
  returnedState: string | null
): Promise<{ ok: boolean; returnTo: string }> {
  const cookieStore = await cookies();
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? null;
  const savedReturn = cookieStore.get(OAUTH_RETURN_COOKIE)?.value ?? null;
  cookieStore.set(OAUTH_STATE_COOKIE, '', { ...txCookieOptions(), maxAge: 0 });
  cookieStore.set(OAUTH_RETURN_COOKIE, '', { ...txCookieOptions(), maxAge: 0 });
  const ok = Boolean(savedState) && savedState === returnedState;
  return { ok, returnTo: safeInternalPath(savedReturn, '/my') };
}
