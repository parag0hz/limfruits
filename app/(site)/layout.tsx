import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import ChatWidget from "@/components/chat/ChatWidget";
import PromoPopup from "@/components/promo/PromoPopup";
import { getStore } from "@/lib/db";

/**
 * 손님용 사이트 레이아웃 — 홈/주문/주문조회에만 Header·Footer를 붙인다.
 * (/admin은 부모님용 화면이라 자체 관리자 nav만 사용)
 * 입장 팝업(v2.6)은 관리자가 켠 경우(promo.enabled)에만 마운트한다 — /admin 에는 영향 없음.
 */
export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const promo = await getStore().getPromo();
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
      {process.env.ANTHROPIC_API_KEY ? <ChatWidget /> : null}
      {promo.enabled ? <PromoPopup promo={promo} /> : null}
    </>
  );
}
