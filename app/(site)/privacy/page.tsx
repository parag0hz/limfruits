import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "임과일(limfruits)의 개인정보 수집·이용, 제3자 제공, 처리위탁, 보유기간, 정보주체의 권리에 관한 안내입니다.",
};

/** 조문 섹션 — 번호 + 제목 + 본문 */
function Section({
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
        <span className="text-brand">{no}.</span> {title}
      </h2>
      <div className="mt-3 text-[15px] leading-7 text-muted">{children}</div>
    </section>
  );
}

/** 그린 점 마커 불릿 목록 */
function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className="mt-3 h-1 w-1 shrink-0 rounded-full bg-brand"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="text-sm font-medium text-brand">임과일 limfruits</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          개인정보처리방침
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-muted">
          풍천대봉감농원(이하 &lsquo;회사&rsquo;)은 임과일(limfruits) 온라인 판매
          서비스를 운영하며, 「개인정보 보호법」 및 「전자상거래 등에서의
          소비자보호에 관한 법률」 등 관련 법령을 준수합니다. 회사는 이용자의
          개인정보를 소중히 다루기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>
      </header>

      <Section no={1} title="개인정보의 수집 항목 및 방법">
        <p>회사는 주문 처리와 고객 응대에 필요한 최소한의 개인정보를 수집합니다.</p>
        <dl className="mt-4 divide-y divide-hairline border-y border-hairline">
          <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
            <dt className="shrink-0 font-medium text-ink sm:w-44">주문·결제 시</dt>
            <dd>
              주문자 성명, 연락처, 주소, 우편번호, 주문·결제 내역, 배송 메모
            </dd>
          </div>
          <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
            <dt className="shrink-0 font-medium text-ink sm:w-44">
              선물·대량 주문 시
            </dt>
            <dd>
              받는 분의 성명, 연락처, 주소, 우편번호, 선물 메시지
            </dd>
          </div>
          <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
            <dt className="shrink-0 font-medium text-ink sm:w-44">
              구매 후기 작성 시
            </dt>
            <dd>
              후기 내용, 첨부 사진, 본인 확인을 위한 주문번호 및 연락처
            </dd>
          </div>
          <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
            <dt className="shrink-0 font-medium text-ink sm:w-44">선택 항목</dt>
            <dd>광고성 정보(문자) 수신동의 여부</dd>
          </div>
        </dl>
        <p className="mt-4">
          개인정보는 이용자가 주문 및 후기 작성 과정에서 직접 입력하는 방식으로
          수집됩니다. 신용카드 번호 등 결제정보는 결제대행사인
          토스페이먼츠(주)가 처리하며, 회사는 이를 보관하지 않습니다.
        </p>
      </Section>

      <Section no={2} title="개인정보의 수집·이용 목적">
        <Bullets
          items={[
            "주문 상품의 확인, 결제, 배송 및 주문 조회",
            "고객 문의에 대한 응대 및 상담",
            "구매 후기의 게시 및 관리",
            "수신에 동의한 이용자에 한하여 명절·행사 등 혜택 및 이벤트 정보 안내",
          ]}
        />
      </Section>

      <Section no={3} title="개인정보의 보유 및 이용 기간">
        <p>
          회사는 개인정보의 수집·이용 목적이 달성되면 지체 없이 파기합니다. 다만
          관련 법령에서 정한 기간 동안 아래와 같이 보존합니다.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-ink">
                <th className="py-2.5 pr-4 font-semibold">보존 항목</th>
                <th className="py-2.5 pr-4 font-semibold">보존 기간</th>
                <th className="py-2.5 font-semibold">근거 법령</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">계약 또는 청약철회 등에 관한 기록</td>
                <td className="py-2.5 pr-4 whitespace-nowrap">5년</td>
                <td className="py-2.5" rowSpan={4}>
                  전자상거래 등에서의 소비자보호에 관한 법률
                </td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">
                  대금결제 및 재화 등의 공급에 관한 기록
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">5년</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">
                  소비자의 불만 또는 분쟁처리에 관한 기록
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">3년</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">표시·광고에 관한 기록</td>
                <td className="py-2.5 pr-4 whitespace-nowrap">6개월</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section no={4} title="개인정보의 제3자 제공">
        <p>
          회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만
          주문 상품의 배송을 위해 아래와 같이 필요한 최소한의 정보를 제공합니다.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-ink">
                <th className="py-2.5 pr-4 font-semibold">제공받는 자</th>
                <th className="py-2.5 pr-4 font-semibold">제공 항목</th>
                <th className="py-2.5 pr-4 font-semibold">이용 목적</th>
                <th className="py-2.5 font-semibold">보유·이용 기간</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">택배사(로젠택배 등)</td>
                <td className="py-2.5 pr-4">받는 분 성명, 연락처, 주소</td>
                <td className="py-2.5 pr-4">주문 상품의 배송</td>
                <td className="py-2.5">
                  배송 완료 후 관련 법령에 따른 기간
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section no={5} title="개인정보 처리의 위탁">
        <p>
          회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를
          외부 전문업체에 위탁하고 있으며, 수탁사가 관련 법령을 준수하도록
          관리·감독합니다.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-ink">
                <th className="py-2.5 pr-4 font-semibold">수탁사</th>
                <th className="py-2.5 font-semibold">위탁 업무</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">토스페이먼츠(주)</td>
                <td className="py-2.5">결제 처리 및 결제 관련 본인 인증</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">택배사(로젠택배 등)</td>
                <td className="py-2.5">주문 상품의 배송</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">Supabase (서울 리전)</td>
                <td className="py-2.5">주문·후기 등 서비스 데이터의 보관</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">알리고 (이용 시)</td>
                <td className="py-2.5">주문·배송 알림 문자 발송</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">Anthropic, PBC (이용 시)</td>
                <td className="py-2.5">AI 상담 응대</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 text-base font-semibold text-ink">
          개인정보의 국외 이전
        </h3>
        <p className="mt-2">
          회사는 AI 상담 기능을 제공하는 경우 아래와 같이 개인정보를 국외에서
          처리합니다. 서비스 데이터를 보관하는 Supabase는 서울 리전을 이용하여
          국내에서 처리됩니다.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-ink">
                <th className="py-2.5 pr-4 font-semibold">이전받는 자</th>
                <th className="py-2.5 pr-4 font-semibold">이전 항목</th>
                <th className="py-2.5 pr-4 font-semibold">이전 국가</th>
                <th className="py-2.5 pr-4 font-semibold">이전 방법</th>
                <th className="py-2.5 font-semibold">이용 목적·보유 기간</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-b border-hairline">
                <td className="py-2.5 pr-4">Anthropic, PBC</td>
                <td className="py-2.5 pr-4">
                  AI 상담 시 이용자가 입력한 문의 내용
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">미국</td>
                <td className="py-2.5 pr-4">
                  상담 이용 시 정보통신망을 통한 전송
                </td>
                <td className="py-2.5">
                  AI 상담 응대 · 응대 목적 달성 시까지(별도 보관하지 않음)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section no={6} title="정보주체의 권리 및 행사 방법">
        <p>
          이용자는 언제든지 자신의 개인정보에 대해 다음의 권리를 행사할 수
          있습니다.
        </p>
        <Bullets
          items={[
            "개인정보 열람 요구",
            "오류 등이 있을 경우 정정 요구",
            "삭제 요구",
            "처리정지 요구",
          ]}
        />
        <p className="mt-3">
          권리 행사는 아래 개인정보 보호책임자에게 서면 또는 전화로 연락하시면
          지체 없이 조치합니다. 회사는 만 14세 미만 아동의 개인정보를 수집하지
          않습니다.
        </p>
      </Section>

      <Section no={7} title="개인정보의 파기 절차 및 방법">
        <p>
          회사는 보유 기간이 경과하거나 처리 목적이 달성된 개인정보를 지체 없이
          파기합니다.
        </p>
        <Bullets
          items={[
            "파기 절차: 목적이 달성된 개인정보는 별도의 저장 공간으로 옮겨 내부 방침 및 관련 법령에 따라 일정 기간 보관한 후 파기합니다.",
            "파기 방법: 전자적 파일 형태의 정보는 복구할 수 없는 방법으로 삭제하며, 종이에 출력된 정보는 분쇄하거나 소각합니다.",
          ]}
        />
      </Section>

      <Section no={8} title="개인정보의 안전성 확보 조치">
        <p>
          회사는 개인정보의 안전한 처리를 위해 다음과 같은 조치를 취하고
          있습니다.
        </p>
        <Bullets
          items={[
            "관리적 조치: 개인정보 취급자를 최소한으로 제한하고 접근 권한을 관리합니다.",
            "기술적 조치: 개인정보에 대한 접근 통제, 전송 구간 암호화 등 보안 조치를 적용합니다.",
            "결제 및 인증 정보는 결제대행사를 통해 안전하게 처리되며 회사가 직접 보관하지 않습니다.",
          ]}
        />
      </Section>

      <Section no={9} title="자동 수집 장치의 설치·운영">
        <p>
          회사는 서비스 이용 편의를 위해 이용자의 브라우저에 최소한의 쿠키 및
          로컬 저장소를 사용할 수 있습니다. 이는 상담 대화 유지, 안내 팝업의
          노출 여부 기억 등 서비스 운영을 위한 것이며, 이용자는 브라우저 설정을
          통해 저장을 거부하거나 삭제할 수 있습니다.
        </p>
      </Section>

      <Section no={10} title="개인정보 보호책임자">
        <p>
          회사는 개인정보 처리에 관한 업무를 총괄하고 이용자의 문의·불만을
          처리하기 위해 개인정보 보호책임자를 지정하고 있습니다.
        </p>
        <dl className="mt-4 divide-y divide-hairline border-y border-hairline">
          <div className="flex gap-6 py-3">
            <dt className="w-24 shrink-0 font-medium text-ink">성명</dt>
            <dd>임용균 (대표자)</dd>
          </div>
          <div className="flex gap-6 py-3">
            <dt className="w-24 shrink-0 font-medium text-ink">연락처</dt>
            <dd>
              <a
                href="tel:010-2618-5151"
                className="underline underline-offset-2 hover:text-ink"
              >
                010-2618-5151
              </a>
            </dd>
          </div>
        </dl>
      </Section>

      <Section no={11} title="개인정보처리방침의 변경">
        <p>
          이 개인정보처리방침은 법령이나 서비스의 변경 사항을 반영하기 위해
          수정될 수 있으며, 변경 시 웹사이트를 통해 그 내용을 공지합니다.
        </p>
      </Section>

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
          본 방침은 2026년 8월 10일부터 시행됩니다.
        </p>
        <p className="mt-4 text-sm text-muted">
          <Link
            href="/terms"
            className="underline underline-offset-2 hover:text-ink"
          >
            이용약관
          </Link>
        </p>
      </footer>
    </div>
  );
}
