import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** 관리자 세션 쿠키 이름 */
export const ADMIN_COOKIE = "limfruits_admin";

/** 세션 유효기간: 7일 (초) */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * AUTH_SECRET 미설정 시 `next dev` 한정 폴백.
 * 소스에 적힌 공개 문자열이 서명 키가 되면 누구나 admin JWT를 위조할 수 있으므로,
 * NODE_ENV가 development가 아니면(프로덕션 빌드 등) 폴백 없이 즉시 throw한다(fail-closed).
 * (개발 모드 폴백을 프로세스별 랜덤 값으로 바꾸지 않는 이유: middleware는 edge 샌드박스,
 *  라우트 핸들러는 node 런타임에서 돌아 globalThis를 공유하지 않으므로 서명/검증 키가
 *  어긋나 데모 로그인 자체가 불가능해진다.)
 */
const DEV_FALLBACK_SECRET =
  "limfruits-dev-only-fallback-secret-change-me-in-production";

let warnedFallback = false;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "development") {
      throw new Error(
        "[limfruits] AUTH_SECRET이 설정되지 않았습니다. 프로덕션에서는 AUTH_SECRET(32자 이상 랜덤)을 반드시 설정해야 관리자 기능을 사용할 수 있습니다."
      );
    }
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn(
        "[limfruits] AUTH_SECRET이 설정되지 않아 개발용 폴백 시크릿을 사용합니다. 프로덕션에서는 반드시 AUTH_SECRET(32자 이상 랜덤)을 설정하세요."
      );
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(secret);
}

/**
 * 관리자 비밀번호.
 * - ADMIN_PASSWORD 설정 시 그 값
 * - 미설정 시 `next dev`에서만 데모 기본값 "limfruits" (README에 경고 명시)
 * - 프로덕션에서 미설정이면 null 반환 → 로그인 자체를 거부(fail-closed)
 */
export function getAdminPassword(): string | null {
  const configured = process.env.ADMIN_PASSWORD;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "development") return null;
  return "limfruits";
}

/** 관리자 세션 JWT 발급 (HS256, 만료 7일) */
export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

/** 세션 JWT 검증 — 유효하면 true. (edge 런타임 호환: jose만 사용) */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** 세션 쿠키 옵션 (httpOnly, secure는 프로덕션만, sameSite lax) */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

/** 현재 요청의 세션 쿠키가 유효한지 (server component/route handler 전용) */
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(ADMIN_COOKIE)?.value);
}

/**
 * API 라우트 가드. 인증 실패 시 401 응답을 반환하고, 성공 시 null을 반환한다.
 *
 * ```ts
 * const unauthorized = await requireAdmin();
 * if (unauthorized) return unauthorized;
 * ```
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdminAuthenticated()) return null;
  return NextResponse.json(
    { error: "관리자 로그인이 필요합니다." },
    { status: 401 }
  );
}
