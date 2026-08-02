import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "관리자 로그인",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // 이미 로그인된 상태면 바로 주문 목록으로
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <h1 className="text-center text-3xl font-bold tracking-tight text-ink">
        관리자 로그인
      </h1>
      <p className="mt-2 text-center text-lg text-muted">
        비밀번호를 입력해 주세요
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
    </main>
  );
}
