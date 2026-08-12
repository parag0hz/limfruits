import type { Metadata } from "next";
import { getStore } from "@/lib/db";
import PromoForm from "./PromoForm";

export const metadata: Metadata = {
  title: "입장 팝업 설정",
};

export const dynamic = "force-dynamic";

export default async function AdminPromoPage() {
  const promo = await getStore().getPromo();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          입장 팝업
        </h1>
        <p className="mt-1 text-base text-muted">
          손님이 사이트에 들어올 때 뜨는 안내 창입니다. 추석·설 선물세트 발송
          기간을 달력으로 보여 줍니다. 아래에서 날짜와 문구를 정하고, 준비가
          되면 &lsquo;노출&rsquo;을 켜 주세요.
        </p>
      </div>

      <PromoForm promo={promo} />
    </div>
  );
}
