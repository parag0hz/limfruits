"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui/cn";

const NAV_ITEMS = [
  { href: "/admin", label: "주문 관리" },
  { href: "/admin/products", label: "상품 관리" },
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
            "inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border-2 px-3 text-lg font-bold transition-colors",
            isActive(item.href)
              ? "border-brand-dark bg-brand text-white"
              : "border-brand/40 bg-white text-brand-dark hover:bg-brand-light"
          )}
        >
          {item.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border-2 border-ink/25 bg-white px-3 text-base font-bold text-ink/60 transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loggingOut ? "..." : "로그아웃"}
      </button>
    </nav>
  );
}
