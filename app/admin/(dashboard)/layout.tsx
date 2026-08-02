import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import AdminNav from "./AdminNav";

export const metadata: Metadata = {
  title: "관리자",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // middleware가 1차 방어선이지만, 페이지들이 고객 PII를 직접 렌더하므로
  // 레이아웃에서도 세션을 재검증한다 (matcher 실수·미들웨어 우회 대비 이중 방어).
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-12">
      <AdminNav />
      {children}
    </main>
  );
}
