"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui/cn";

// 항목 4개 + 로그아웃이 좁은 휴대폰(360px)에서도 한 줄에 들어가도록 짧은 라벨 사용
const NAV_ITEMS = [
  { href: "/admin", label: "주문" },
  { href: "/admin/products", label: "상품" },
  { href: "/admin/reviews", label: "리뷰" },
  { href: "/admin/promo", label: "팝업" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  function isActive(href: string): boolean {
    if (href === "/admin") {
      return pathname === "/admin" || pathname.startsWith("/admin/orders");
    }
    return pathname.startsWith(href);
  }

  return (
    <nav
      aria-label="관리자 메뉴"
      className="mb-5 flex items-center gap-2"
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn(
            "inline-flex min-h-12 flex-1 items-center justify-center rounded-full px-3 text-lg font-bold transition-colors",
            isActive(item.href)
              ? "bg-brand text-white"
              : "border border-hairline bg-white text-ink hover:bg-surface"
          )}
        >
          {item.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-hairline bg-white px-3 text-base font-semibold text-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loggingOut ? "..." : "로그아웃"}
      </button>
    </nav>
  );
}
