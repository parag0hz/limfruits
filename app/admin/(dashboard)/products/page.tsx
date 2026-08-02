import type { Metadata } from "next";
import { getStore } from "@/lib/db";
import OptionEditor from "./OptionEditor";

export const metadata: Metadata = {
  title: "상품 관리",
};

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const store = getStore();
  const options = await store.listOptions();

  return (
    <div>
      <h1 className="font-heading text-2xl text-brand-dark">상품 관리</h1>
      <p className="mt-1 text-base text-ink/60">
        가격이나 이름을 고친 뒤 꼭 &lsquo;저장&rsquo;을 눌러 주세요. 품절은
        누르면 바로 저장됩니다.
      </p>

      {options.length === 0 ? (
        <div className="mt-8 rounded-3xl border-2 border-dashed border-brand/40 bg-white px-5 py-12 text-center">
          <p className="text-xl font-bold text-ink/60">
            등록된 상품 옵션이 없습니다.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {options.map((option) => (
            <li key={option.id}>
              <OptionEditor option={option} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
