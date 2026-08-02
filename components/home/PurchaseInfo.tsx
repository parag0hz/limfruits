import Link from "next/link";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "배송은 얼마나 걸리나요?",
    a: "결제 확인 후 산지에서 순서대로 발송하며, 발송 후에는 보통 1~2일 안에 도착합니다. 명절 전후나 택배사 사정에 따라 하루 이틀 더 걸릴 수 있어요.",
  },
  {
    q: "배는 어떻게 보관하면 좋나요?",
    a: "받으신 배는 하나씩 신문지나 키친타월로 감싸 냉장 보관하시면 아삭한 식감이 오래 갑니다. 실온에 두실 경우 서늘하고 그늘진 곳에 두세요.",
  },
  {
    q: "선물 포장이 되나요?",
    a: "선물세트 옵션은 선물용 박스에 담아 보내드립니다. 받으실 분 주소로 배송지를 입력하시고, 요청사항이 있으면 주문 시 배송 메모에 남겨주세요.",
  },
  {
    q: "주문 내역은 어디서 확인하나요?",
    a: (
      <>
        회원가입 없이 주문번호와 전화번호만으로 확인하실 수 있어요.{" "}
        <Link
          href="/order/lookup"
          className="font-bold text-brand-dark underline underline-offset-2"
        >
          주문조회 페이지
        </Link>
        에서 조회해 주세요.
      </>
    ),
  },
];

/** 구매 안내 — 배송 / 교환·환불 / 문의 + 자주 묻는 질문 */
export default function PurchaseInfo() {
  return (
    <section id="guide" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
      <SectionTitle align="center" sub="주문 전에 한 번 읽어봐 주세요">
        구매 안내
      </SectionTitle>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="font-heading text-xl text-brand-dark">배송 안내</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink/80">
            <li>· 결제 확인 후 나주 산지에서 바로 포장해 택배로 발송합니다.</li>
            <li>· 수확·주문 상황에 따라 발송까지 며칠 걸릴 수 있으며, 주문 순서대로 보내드립니다.</li>
            <li>· 표시된 가격에 배송비가 포함되어 있습니다.</li>
            <li>· 제주·도서산간 지역은 배송이 하루 이틀 더 걸릴 수 있습니다.</li>
          </ul>
        </Card>

        <Card>
          <h3 className="font-heading text-xl text-brand-dark">교환·환불 안내</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink/80">
            <li>· 신선식품 특성상 단순 변심에 의한 교환·환불은 어려운 점 양해 부탁드립니다.</li>
            <li>· 배송 중 파손되었거나 상품에 문제가 있다면, 받으신 당일 사진과 함께 연락 주세요.</li>
            <li>· 확인 후 새 상품으로 다시 보내드리거나 환불해 드립니다.</li>
          </ul>
        </Card>

        <Card tone="light">
          <h3 className="font-heading text-xl text-brand-dark">문의하기</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink/80">
            궁금하신 점은 언제든 전화 주세요. 농사일 중에는 받기 어려울 수
            있으니, 못 받으면 꼭 다시 걸어드릴게요.
          </p>
          <a
            href="tel:010-0000-0000"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl border-2 border-brand bg-white px-5 text-lg font-bold text-brand-dark transition-colors hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            010-OOOO-OOOO
          </a>
          <p className="mt-2 text-xs text-ink/55">
            (실제 연락처로 교체 예정 — 준비 중입니다)
          </p>
        </Card>
      </div>

      <h3 className="mt-12 text-center font-heading text-2xl text-brand-dark">
        자주 묻는 질문
      </h3>
      <div className="mx-auto mt-5 max-w-3xl space-y-3">
        {FAQS.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-2xl border-2 border-brand bg-white"
          >
            <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold text-ink [&::-webkit-details-marker]:hidden">
              <span>{faq.q}</span>
              <span
                aria-hidden
                className="shrink-0 text-xl leading-none text-brand transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="border-t-2 border-brand-light px-4 py-3 text-sm leading-relaxed text-ink/80">
              {faq.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export { PurchaseInfo };
