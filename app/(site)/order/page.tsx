import type { Metadata } from 'next';
import { getStore } from '@/lib/db';
import OrderForm from '@/components/order/OrderForm';

export const metadata: Metadata = {
  title: '주문하기',
  description: '임과일 나주배 주문 — 옵션 선택부터 결제까지 한 번에.',
};

export const dynamic = 'force-dynamic';

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ option?: string | string[] }>;
}) {
  const { option } = await searchParams;
  const preselectedId = typeof option === 'string' ? option : undefined;
  const options = await getStore().listOptions();

  return <OrderForm options={options} preselectedId={preselectedId} />;
}
