import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db';
import { getUserSession } from '@/lib/user-auth';
import OrderForm from '@/components/order/OrderForm';

export const metadata: Metadata = {
  title: '주문하기',
  description: '임과일 산지 직송 주문 — 배송 정보 입력부터 결제까지.',
};

export const dynamic = 'force-dynamic';

const MAX_QUANTITY = 20;

function first(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * 주문·결제 — 상품 상세에서 옵션을 고른 뒤 진입한다.
 * ?option=<id> 필수 (없거나 유효하지 않으면 홈으로), &qty= 초기 수량 반영.
 */
export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ option?: string | string[]; qty?: string | string[] }>;
}) {
  const sp = await searchParams;
  const optionId = first(sp.option);
  if (!optionId) {
    redirect('/');
  }

  const store = getStore();
  const option = await store.getOption(optionId);
  if (!option) {
    redirect('/');
  }

  const product = await store.getProduct(option.productId);
  if (!product || !product.isActive) {
    redirect('/');
  }

  // 같은 상품의 옵션만 보여준다
  const options = await store.listOptions(product.id);

  const qtyRaw = Number(first(sp.qty));
  const initialQuantity =
    Number.isInteger(qtyRaw) && qtyRaw >= 1
      ? Math.min(qtyRaw, MAX_QUANTITY)
      : 1;

  // v2.8 — 로그인 상태면 유저 닉네임으로 주문자 성함을 프리필(선택, 수정 가능).
  // 세션·유저 조회 실패는 비회원으로 강등(주문 흐름에 영향 없음).
  const initialCustomerName = await resolveNickname(store);

  return (
    <OrderForm
      productName={product.name}
      options={options}
      preselectedId={option.id}
      initialQuantity={initialQuantity}
      initialCustomerName={initialCustomerName}
    />
  );
}

/** 유저 세션이 있으면 닉네임을, 없으면(비회원·조회 실패) undefined 를 돌려준다. */
async function resolveNickname(
  store: ReturnType<typeof getStore>
): Promise<string | undefined> {
  try {
    const session = await getUserSession();
    if (!session) return undefined;
    const user = await store.getUser(session.userId);
    return user?.nickname?.trim() || undefined;
  } catch {
    return undefined;
  }
}
