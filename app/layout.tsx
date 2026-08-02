import type { Metadata } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const jua = Jua({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-jua",
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "임과일 — 나주배 직판",
    template: "%s | 임과일",
  },
  description:
    "가족이 직접 농사지은 나주배를 산지에서 바로 보내드립니다. 임과일 나주배 직판 온라인 주문.",
  openGraph: {
    title: "임과일 — 나주배 직판",
    description:
      "가족이 직접 농사지은 나주배를 산지에서 바로 보내드립니다. 임과일 나주배 직판 온라인 주문.",
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
    <html
      lang="ko"
      className={`${jua.variable} ${notoSansKr.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
