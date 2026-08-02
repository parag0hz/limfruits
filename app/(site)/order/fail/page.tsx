import type { Metadata } from 'next';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import SectionTitle from '@/components/ui/SectionTitle';
import { friendlyTossMessage } from '@/lib/toss';

export const metadata: Metadata = {
  title: '결제 실패',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const buttonBase =
  'inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-lg font-semibold transition-colors';

/**
 * 우리 서버(/order/success)가 넘기는 내부 실패 코드 → 안내 문구.
 * 화면 문구는 이 화이트리스트 + 토스 코드 화이트리스트(friendlyTossMessage)에서만 고른다.
 * URL의 message 파라미터를 그대로 렌더링하면 판매자 도메인 위에 임의 문구를
 * 띄우는 피싱(예: 계좌이체 유도)에 악용될 수 있어 표시하지 않는다.
 */
const INTERNAL_FAIL_MESSAGES: Record<string, string> = {
  LIMFRUITS_MISSING_PARAMS:
    '결제 정보가 올바르게 전달되지 않았어요. 다시 시도해 주세요.',
  LIMFRUITS_ORDER_NOT_FOUND:
    '주문 정보를 찾을 수 없어요. 처음부터 다시 주문해 주세요.',
  LIMFRUITS_ORDER_CANCELED:
    '이미 취소된 주문이에요. 처음부터 다시 주문해 주세요.',
  LIMFRUITS_AMOUNT_MISMATCH:
    '결제 금액이 주문 금액과 달라 결제를 승인하지 않았어요. 다시 주문해 주세요.',
  LIMFRUITS_ORDER_EXPIRED:
    '주문 후 시간이 오래 지나 결제를 승인하지 않았어요. 처음부터 다시 주문해 주세요.',
  LIMFRUITS_SOLD_OUT:
    '죄송해요, 결제 진행 중에 상품이 품절되어 결제를 승인하지 않았어요. 다른 옵션으로 다시 주문해 주세요.',
  LIMFRUITS_PRODUCT_INACTIVE:
    '죄송해요, 결제 진행 중에 상품 판매가 중단되어 결제를 승인하지 않았어요. 자세한 내용은 판매자에게 문의해 주세요.',
  LIMFRUITS_PAYMENT_MISMATCH:
    '결제 정보가 주문 내용과 일치하지 않아 승인하지 않았어요. 문제가 계속되면 판매자에게 문의해 주세요.',
  LIMFRUITS_CONFIRM_ERROR:
    '결제 승인 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
  LIMFRUITS_MARK_PAID_FAILED:
    '결제는 완료되었지만 주문 처리 중 문제가 생겼어요. 판매자에게 주문번호와 함께 문의해 주세요.',
};

export default async function OrderFailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === 'string' ? sp.code : undefined;
  const message = typeof sp.message === 'string' ? sp.message : undefined;

  const friendly =
    (code && INTERNAL_FAIL_MESSAGES[code]) || friendlyTossMessage(code);

  // 원본 message는 화면에 띄우지 않고 서버 로그로만 남긴다
  if (message && !(code && INTERNAL_FAIL_MESSAGES[code])) {
    console.warn('[limfruits] 결제 실패 리다이렉트:', { code, message });
  }

  // 이 코드만은 결제 자체는 승인된 경우라 "금액이 빠져나가지 않았다" 안내가 틀리다
  const paymentWentThrough = code === 'LIMFRUITS_MARK_PAID_FAILED';

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12 sm:px-6">
      <SectionTitle as="h1">결제가 완료되지 않았습니다</SectionTitle>

      <Card>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          {/* 안내 아이콘 */}
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7 text-danger"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 7v6" />
              <circle cx="12" cy="17" r="0.5" fill="currentColor" />
            </svg>
          </span>
          <p className="text-lg font-medium text-ink">{friendly}</p>
          {paymentWentThrough ? (
            <p className="text-sm text-muted">
              결제 내역과 주문번호를 확인해 판매자에게 문의해 주시면 바로
              처리해 드리겠습니다.
            </p>
          ) : (
            <p className="text-sm text-muted">
              결제가 진행되지 않아 금액이 빠져나가지 않았습니다. 잠시 후 다시
              시도하시거나, 문제가 계속되면 판매자에게 문의해 주세요.
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        {/* 주문은 상품 상세에서 시작하므로 홈(카탈로그)으로 안내 */}
        <Link
          href="/"
          className={`${buttonBase} flex-1 bg-brand text-white hover:bg-brand-dark`}
        >
          다시 주문하기
        </Link>
        <Link
          href="/order/lookup"
          className={`${buttonBase} flex-1 bg-surface text-ink hover:bg-hairline/70`}
        >
          주문조회
        </Link>
      </div>
    </div>
  );
}
