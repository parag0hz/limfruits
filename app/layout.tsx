import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "임과일 — 나주배 직판",
    template: "%s | 임과일",
  },
  description:
    "전남 나주 농장에서 직접 재배하고, 주문 확인 후 산지에서 발송합니다. 임과일 나주배 직판 온라인 주문.",
  openGraph: {
    title: "임과일 — 나주배 직판",
    description:
      "전남 나주 농장에서 직접 재배하고, 주문 확인 후 산지에서 발송합니다. 임과일 나주배 직판 온라인 주문.",
    images: ["/logo.jpeg"],
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
