import type { Metadata } from 'next';
import Link from 'next/link';
import { getStore } from '@/lib/db';
import { verifyOrderViewToken } from '@/lib/order-token';
import { formatWon, formatPhone } from '@/lib/format';

/** "010-1234-5678" → "010-****-5678" (주문번호만으로 열리는 페이지라 가운데 자리 마스킹) */
function maskPhone(phone: string): string {
  const formatted = formatPhone(phone);
  const parts = formatted.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-${'*'.repeat(parts[1].length)}-${parts[2]}`;
  }
  return formatted;
}
import Card from '@/components/ui/Card';
import SectionTitle from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: '주문 완료',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const buttonClass =
  'inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-6 py-3 text-lg font-bold transition-colors';

export default async function OrderCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderNo: rawOrderNo } = await params;
  const sp = await searchParams;
  // Next가 이미 percent-decode한 값이므로 재디코딩 실패("100%" 등)에도 500이 나지 않게 처리
  let decoded = rawOrderNo;
  try {
    decoded = decodeURIComponent(rawOrderNo);
  } catch {
    // 원문 그대로 사용
  }
  const orderNo = decoded.trim().toUpperCase();
  const order = await getStore().getOrderByNo(orderNo);

  if (!order || order.status === 'PENDING' || order.status === 'CANCELED') {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12 sm:px-6">
        <SectionTitle as="h1">주문을 찾을 수 없어요</SectionTitle>
        <Card>
          <p className="text-ink/80">
            완료된 주문을 찾지 못했어요. 주문번호를 다시 확인하시거나
            주문조회를 이용해 주세요.
          </p>
        </Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/order/lookup"
            className={`${buttonClass} flex-1 border-brand-dark bg-brand text-white hover:bg-brand-dark`}
          >
            주문조회 하러 가기
          </Link>
          <Link
            href="/"
            className={`${buttonClass} flex-1 border-brand bg-white text-brand-dark hover:bg-brand-light`}
          >
            홈으로 가기
          </Link>
        </div>
      </div>
    );
  }

  // 결제 직후 리다이렉트에 실린 단기 서명 토큰이 있어야만 이름·주소·메모를 보여준다.
  // 토큰이 없으면(링크 공유, 주문번호 추측, 만료 등) 최소 정보만 보여주고
  // 상세 확인은 전화번호 검증이 있는 /order/lookup으로 유도한다.
  const token = typeof sp.t === 'string' ? sp.t : undefined;
  const canViewDetails = verifyOrderViewToken(order.orderNo, token);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12 sm:px-6">
      {/* 완료 안내 */}
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand bg-brand-light"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 text-brand"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4.5 12.5l5 5 10-11" />
          </svg>
        </span>
        <SectionTitle
          as="h1"
          align="center"
          sub="주문해 주셔서 진심으로 감사합니다. 정성껏 골라 보내드릴게요."
        >
          주문이 완료되었어요
        </SectionTitle>
      </div>

      {/* 주문번호 */}
      <Card tone="light" className="text-center">
        <p className="text-sm font-bold text-brand-dark">주문번호</p>
        <p className="mt-1 font-heading text-3xl tracking-wide text-brand-dark">
          {order.orderNo}
        </p>
        <p className="mt-2 text-sm text-ink/60">
          주문조회에 필요하니 꼭 보관해 주세요.
        </p>
      </Card>

      {/* 주문 내역 */}
      <Card>
        <h2 className="font-heading text-xl text-brand-dark">주문 내역</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {order.items.map((item) => (
            <li
              key={item.optionId}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-ink">
                {item.optionName}
                <span className="ml-1.5 text-ink/60">× {item.quantity}</span>
              </span>
              <span className="font-bold text-ink">
                {formatWon(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t-2 border-brand/15 pt-4">
          <span className="font-bold text-ink">결제 금액</span>
          <span className="text-xl font-bold text-brand-dark">
            {formatWon(order.totalAmount)}
          </span>
        </div>
        {order.paymentMethod && (
          <p className="mt-2 text-right text-sm text-ink/60">
            결제수단: {order.paymentMethod}
          </p>
        )}
      </Card>

      {/* 배송지 — 결제 직후 본인에게만 표시 */}
      {canViewDetails ? (
        <Card>
          <h2 className="font-heading text-xl text-brand-dark">배송지</h2>
          <dl className="mt-4 flex flex-col gap-1.5 text-ink">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink/60">받는 분</dt>
              <dd className="font-medium">{order.customerName}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink/60">연락처</dt>
              <dd className="font-medium">{maskPhone(order.phone)}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink/60">주소</dt>
              <dd className="font-medium">
                ({order.postcode}) {order.address1}
                {order.address2 && ` ${order.address2}`}
              </dd>
            </div>
            {order.memo && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink/60">메모</dt>
                <dd className="font-medium">{order.memo}</dd>
              </div>
            )}
          </dl>
        </Card>
      ) : (
        <Card>
          <h2 className="font-heading text-xl text-brand-dark">배송지 확인</h2>
          <p className="mt-3 text-ink/80">
            개인정보 보호를 위해 배송지 정보는 이 화면에 표시하지 않아요. 받는
            분과 주소는 주문하실 때 입력하신 전화번호로 주문조회에서 확인하실
            수 있어요.
          </p>
        </Card>
      )}

      {/* 배송 안내 */}
      <Card tone="light">
        <h2 className="font-heading text-xl text-brand-dark">배송 안내</h2>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-ink/80">
          <li>결제가 확인되면 신선한 배를 정성껏 포장해 순차 발송해 드려요.</li>
          <li>발송이 시작되면 주문조회에서 운송장 번호를 확인하실 수 있어요.</li>
          <li>
            주문 내용 변경이나 취소가 필요하시면 발송 전에 판매자에게 문의해
            주세요.
          </li>
        </ul>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/order/lookup?orderNo=${encodeURIComponent(order.orderNo)}`}
          className={`${buttonClass} flex-1 border-brand-dark bg-brand text-white hover:bg-brand-dark`}
        >
          주문조회 하기
        </Link>
        <Link
          href="/"
          className={`${buttonClass} flex-1 border-brand bg-white text-brand-dark hover:bg-brand-light`}
        >
          홈으로 가기
        </Link>
      </div>
    </div>
  );
}
