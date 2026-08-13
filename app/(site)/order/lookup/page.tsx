import type { Metadata } from 'next';
import SectionTitle from '@/components/ui/SectionTitle';
import LookupForm from '@/components/order/LookupForm';
import FindOrderByName from '@/components/order/FindOrderByName';

export const metadata: Metadata = {
  title: '주문조회',
  description: '주문번호와 연락처로 임과일 주문·배송 현황을 확인하세요.',
};

export default async function OrderLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNo?: string | string[] }>;
}) {
  const { orderNo } = await searchParams;
  const initialOrderNo = typeof orderNo === 'string' ? orderNo : '';

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <SectionTitle
        as="h1"
        sub="주문번호와 주문 시 입력하신 연락처를 입력해 주세요."
      >
        주문조회
      </SectionTitle>
      <LookupForm initialOrderNo={initialOrderNo} />
      <FindOrderByName />
    </div>
  );
}
