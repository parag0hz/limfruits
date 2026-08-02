import { getStore } from "@/lib/db";
import Hero from "@/components/home/Hero";
import FarmStory from "@/components/home/FarmStory";
import ProductGrid from "@/components/home/ProductGrid";
import PurchaseInfo from "@/components/home/PurchaseInfo";

/** 관리자가 가격/품절을 바꾸면 홈에 즉시 반영되도록 항상 동적 렌더 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const options = await getStore().listOptions();

  return (
    <div className="flex flex-col">
      <Hero />
      <FarmStory />
      <ProductGrid options={options} />
      <PurchaseInfo />
    </div>
  );
}
