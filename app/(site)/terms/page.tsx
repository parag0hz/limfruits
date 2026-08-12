import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "이용약관",
  description:
    "임과일(limfruits) 서비스 이용약관입니다. 비회원 주문, 결제, 배송, 청약철회·반품·교환, 분쟁해결에 관한 내용을 안내합니다.",
};

/** 조문 섹션 — 제N조 (제목) + 본문 */
function Article({
  no,
  title,
  children,
}: {
  no: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
        <span className="text-brand">제{no}조</span> ({title})
      </h2>
      <div className="mt-3 text-[15px] leading-7 text-muted">{children}</div>
    </section>
  );
}

/** 항 번호(①②…) 목록 */
const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
function Clauses({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className="shrink-0 font-medium text-ink tabular-nums"
          >
            {CIRCLED[i] ?? `${i + 1}.`}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="text-sm font-medium text-brand">임과일 limfruits</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          이용약관
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-muted">
          이 약관은 풍천대봉감농원이 운영하는 임과일(limfruits) 인터넷 사이트에서
          제공하는 전자상거래 관련 서비스의 이용 조건과 절차, 회사와 이용자의
          권리·의무 및 책임사항을 규정합니다.
        </p>
      </header>

      <Article no={1} title="목적">
        <p>
          이 약관은 풍천대봉감농원(이하 &lsquo;회사&rsquo;)이 운영하는
          임과일(limfruits) 인터넷 사이트(이하 &lsquo;몰&rsquo;)에서 제공하는
          서비스를 이용함에 있어 회사와 이용자의 권리·의무 및 책임사항을 규정함을
          목적으로 합니다.
        </p>
      </Article>

      <Article no={2} title="정의">
        <Clauses
          items={[
            "‘몰’이란 회사가 재화를 이용자에게 판매하기 위하여 운영하는 인터넷 사이트(임과일, limfruits)를 말합니다.",
            "‘이용자’란 몰에 접속하여 이 약관에 따라 몰이 제공하는 서비스를 이용하는 자를 말합니다.",
            "‘비회원’이란 회원 가입 없이 몰이 제공하는 서비스를 이용하는 자를 말합니다.",
          ]}
        />
      </Article>

      <Article no={3} title="약관의 게시와 개정">
        <Clauses
          items={[
            "회사는 이 약관의 내용을 이용자가 쉽게 알 수 있도록 몰의 화면에 게시합니다.",
            "회사는 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있으며, 약관을 개정하는 경우 적용일자 및 개정사유를 명시하여 적용일자 이전부터 공지합니다.",
          ]}
        />
      </Article>

      <Article no={4} title="비회원 주문">
        <p>
          몰은 별도의 회원 가입 절차 없이 이용자가 비회원으로 상품을 주문할 수
          있도록 운영됩니다. 이용자는 주문 시 정확한 정보를 입력하여야 하며,
          주문 및 배송 현황은 주문번호와 주문 시 입력한 연락처를 통해 확인할 수
          있습니다.
        </p>
      </Article>

      <Article no={5} title="구매 신청 및 계약의 성립">
        <Clauses
          items={[
            "이용자는 몰에서 상품과 옵션을 선택하고 주문·결제에 필요한 정보를 입력하여 구매를 신청합니다.",
            "구매 계약은 회사가 이용자의 결제 승인 및 주문 접수를 완료한 때에 성립합니다.",
            "회사는 재화의 품절, 결제 오류, 주문 정보의 오기 등의 사유가 있는 경우 구매 신청을 승낙하지 않거나 주문을 취소할 수 있습니다.",
          ]}
        />
      </Article>

      <Article no={6} title="결제 및 판매가격">
        <p>
          결제는 회사가 제공하는 결제대행사(토스페이먼츠)를 통한 신용카드 등
          전자결제 수단으로 이루어집니다. 몰에 표시된 판매가격은 배송비를 포함한
          금액입니다.
        </p>
      </Article>

      <Article no={7} title="배송">
        <Clauses
          items={[
            "회사는 주문 및 결제가 확인된 후 산지에서 상품을 발송합니다.",
            "신선 농산물의 특성과 명절 성수기 등의 사정에 따라 발송이 주문 순서대로 순차적으로 이루어질 수 있습니다.",
            "천재지변, 택배사 사정 등 회사의 통제를 벗어난 불가항력으로 인한 배송 지연에 대하여 회사는 책임을 지지 않습니다.",
          ]}
        />
      </Article>

      <Article no={8} title="청약철회 등">
        <Clauses
          items={[
            "이용자는 관련 법령에 따라 재화를 공급받은 날부터 7일 이내에 청약철회를 할 수 있습니다.",
            "다만 「전자상거래 등에서의 소비자보호에 관한 법률」 및 관련 법령에 따라, 신선 농산물과 같이 시간의 경과로 재판매가 곤란할 정도로 가치가 현저히 감소하는 재화의 경우에는 단순 변심에 의한 청약철회가 제한될 수 있습니다. 이 경우 회사는 상품 상세페이지 등에 해당 사실을 사전에 표시합니다.",
            "이용자의 단순 변심에 의한 반품이 가능한 경우, 반송에 드는 비용은 이용자가 부담합니다.",
          ]}
        />
      </Article>

      <Article no={9} title="반품·교환 및 환불">
        <Clauses
          items={[
            "배송된 상품이 파손·부패되었거나 주문 내용과 다른 경우, 이용자는 상품 수령 후 지체 없이 회사에 통보하고 교환 또는 환불을 요청할 수 있으며, 이 경우 반송 비용은 회사가 부담합니다.",
            "신선도 확인을 위해 상품 수령 즉시 개봉하여 확인하실 것을 권장하며, 회사는 상품 상태 확인을 위해 사진 등의 자료를 요청할 수 있습니다.",
            "환불은 결제한 수단으로 환급하는 것을 원칙으로 하며, 결제대행사의 정책에 따라 처리에 일정 기간이 소요될 수 있습니다.",
          ]}
        />
      </Article>

      <Article no={10} title="회사의 의무">
        <p>
          회사는 관련 법령과 이 약관을 성실히 준수하며, 이용자가 안전하게
          서비스를 이용할 수 있도록 노력합니다. 회사는 이용자의 개인정보를
          개인정보처리방침에 따라 보호합니다.
        </p>
      </Article>

      <Article no={11} title="이용자의 의무">
        <p>
          이용자는 주문 시 정확한 정보를 제공하여야 하며, 타인의 정보를
          도용하거나 회사의 정상적인 업무를 방해하는 행위를 하여서는 안 됩니다.
        </p>
      </Article>

      <Article no={12} title="면책">
        <p>
          회사는 천재지변, 불가항력, 또는 이용자의 귀책사유로 인하여 발생한
          손해에 대하여 책임을 지지 않습니다.
        </p>
      </Article>

      <Article no={13} title="분쟁 해결 및 준거법">
        <Clauses
          items={[
            "회사와 이용자 사이에 발생한 분쟁은 상호 협의를 통하여 원만히 해결하도록 노력합니다.",
            "협의가 이루어지지 않을 경우 관련 법령 및 상관례에 따르며, 이 약관은 대한민국 법령을 준거법으로 합니다.",
          ]}
        />
      </Article>

      <footer className="mt-14 border-t border-hairline pt-8">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-muted sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-ink">상호</dt>
            <dd>풍천대봉감농원</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-ink">대표자</dt>
            <dd>임용균</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-ink">사업자등록번호</dt>
            <dd>412-90-42034</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-ink">통신판매업신고</dt>
            <dd>제2011-전남나주-60호</dd>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 font-medium text-ink">주소</dt>
            <dd>전라남도 나주시 덕룡로 33-8</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-ink">고객센터</dt>
            <dd>
              <a
                href="tel:010-2618-5151"
                className="underline underline-offset-2 hover:text-ink"
              >
                010-2618-5151
              </a>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-ink">카카오톡</dt>
            <dd>limcon1</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm font-medium text-ink">
          본 약관은 2026년 8월 10일부터 시행됩니다.
        </p>
        <p className="mt-4 text-sm text-muted">
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-ink"
          >
            개인정보처리방침
          </Link>
        </p>
      </footer>
    </div>
  );
}
