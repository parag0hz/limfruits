import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createSessionToken,
  getAdminPassword,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";

/** 실패 허용 횟수 — 초과 시 잠금 */
const MAX_FAILURES = 5;
/** 잠금 시간: 15분 */
const LOCKOUT_MS = 15 * 60 * 1000;
/** 실패 카운터 유지 시간 (이 시간 동안 실패가 없으면 카운터 리셋) */
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** 실패 응답 최소 지연 (자동화 대입 속도 저하) */
const FAILURE_DELAY_MS = 400;

interface AttemptRecord {
  failures: number;
  lastFailureAt: number;
  lockedUntil: number;
}

/** IP별 로그인 시도 기록 (인메모리, HMR 생존을 위해 globalThis 캐시) */
const attemptStore: Map<string, AttemptRecord> = ((): Map<
  string,
  AttemptRecord
> => {
  const g = globalThis as {
    __limfruitsLoginAttempts?: Map<string, AttemptRecord>;
  };
  if (!g.__limfruitsLoginAttempts) {
    g.__limfruitsLoginAttempts = new Map();
  }
  return g.__limfruitsLoginAttempts;
})();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "local";
}

function pruneStale(now: number): void {
  if (attemptStore.size < 500) return;
  for (const [key, rec] of attemptStore) {
    if (
      rec.lockedUntil < now &&
      now - rec.lastFailureAt > FAILURE_WINDOW_MS
    ) {
      attemptStore.delete(key);
    }
  }
}

/** 길이를 SHA-256으로 정규화한 뒤 상수시간 비교 */
function passwordsMatch(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST /api/admin/login — { password } → 세션 쿠키 발급 */
export async function POST(request: Request) {
  const now = Date.now();
  const key = clientKey(request);
  pruneStale(now);

  // 잠금 확인 (IP 기준)
  const record = attemptStore.get(key);
  if (record && record.lockedUntil > now) {
    const remainMin = Math.max(
      1,
      Math.ceil((record.lockedUntil - now) / 60_000)
    );
    return NextResponse.json(
      {
        error: `로그인 시도가 너무 많습니다. 약 ${remainMin}분 후에 다시 시도해 주세요.`,
      },
      { status: 429 }
    );
  }

  let password: unknown;
  try {
    const body = (await request.json()) as { password?: unknown };
    password = body.password;
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: "비밀번호를 입력해 주세요." },
      { status: 400 }
    );
  }

  // 프로덕션에서 ADMIN_PASSWORD 미설정이면 로그인 자체를 거부 (fail-closed)
  const adminPassword = getAdminPassword();
  if (adminPassword === null) {
    return NextResponse.json(
      {
        error:
          "관리자 비밀번호가 설정되지 않아 로그인할 수 없습니다. 서버 환경변수 ADMIN_PASSWORD를 설정해 주세요.",
      },
      { status: 503 }
    );
  }

  if (!passwordsMatch(password, adminPassword)) {
    // 실패 기록 + 지수적이지 않은 고정 지연 (응답 시간으로 성공/실패를 더 빨리 구분하지 못하도록)
    const prev =
      record && now - record.lastFailureAt <= FAILURE_WINDOW_MS
        ? record.failures
        : 0;
    const failures = prev + 1;
    attemptStore.set(key, {
      failures,
      lastFailureAt: now,
      lockedUntil: failures >= MAX_FAILURES ? now + LOCKOUT_MS : 0,
    });
    await sleep(FAILURE_DELAY_MS);
    if (failures >= MAX_FAILURES) {
      return NextResponse.json(
        {
          error:
            "비밀번호를 여러 번 잘못 입력해 로그인이 잠시 잠겼습니다. 15분 후에 다시 시도해 주세요.",
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다. 다시 확인해 주세요." },
      { status: 401 }
    );
  }

  attemptStore.delete(key);

  let token: string;
  try {
    token = await createSessionToken();
  } catch {
    // AUTH_SECRET 미설정(프로덕션) 등 — 세션을 발급할 수 없으면 명확히 안내
    return NextResponse.json(
      {
        error:
          "서버 설정 문제로 로그인할 수 없습니다. AUTH_SECRET 환경변수를 확인해 주세요.",
      },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, sessionCookieOptions());
  return response;
}
