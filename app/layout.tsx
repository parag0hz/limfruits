import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

const SITE_DESCRIPTION =
  "전남 나주 풍천대봉감농원에서 직접 재배한 나주배·황금배와 도라지배즙을 산지에서 바로 보내드립니다. 주문 확인 후 신선하게 선별해 발송합니다.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "임과일 — 나주 산지 직송 과일",
    template: "%s | 임과일",
  },
  description: SITE_DESCRIPTION,
  applicationName: "임과일",
  robots: { index: true, follow: true },
  openGraph: {
    title: "임과일 — 나주 산지 직송 과일",
    description: SITE_DESCRIPTION,
    siteName: "임과일",
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
