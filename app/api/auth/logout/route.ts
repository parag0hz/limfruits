import { NextResponse } from 'next/server';
import { clearUserSession } from '@/lib/user-auth';

export const runtime = 'nodejs';

/**
 * POST /api/auth/logout — 유저 세션 쿠키 삭제 후 홈('/')으로.
 * 로그인 여부와 무관하게 항상 성공. 303(See Other)로 폼 POST → '/' GET 전환.
 * (관리자 세션에는 손대지 않는다 — 쿠키가 분리되어 있음.)
 */
export async function POST(request: Request) {
  await clearUserSession();
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
