import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";

/** POST /api/admin/logout — 세션 쿠키 삭제 (로그인 여부와 무관하게 항상 성공) */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
