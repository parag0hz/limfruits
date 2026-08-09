import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import ChatWidget from "@/components/chat/ChatWidget";

/**
 * 손님용 사이트 레이아웃 — 홈/주문/주문조회에만 Header·Footer를 붙인다.
 * (/admin은 부모님용 화면이라 자체 관리자 nav만 사용)
 */
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
      {process.env.ANTHROPIC_API_KEY ? <ChatWidget /> : null}
    </>
  );
}
