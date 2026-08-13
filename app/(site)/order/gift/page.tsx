import type { Metadata } from 'next';
import { getStore } from '@/lib/db';
import { getUserSession } from '@/lib/user-auth';
import GiftOrderForm from '@/components/order/gift/GiftOrderForm';
import type { OptionChoice, ProductLite } from '@/components/order/gift/types';

export const metadata: Metadata = {
  title: '선물·대량 주문',
  description:
    '받는 분마다 다른 구성을 담아 여러 곳으로 한 번에 보내는 선물·대량 주문.',
};

export const dynamic = 'force-dynamic';

/**
 * 선물·대량 주문 (다중 배송지) — v2.4.
 * 활성 상품·재고 있는 옵션만 초기 props 로 전달하고,
 * 실제 입력·결제는 클라이언트 GiftOrderForm 이 담당한다.
 */
export default async function GiftOrderPage() {
  const store = getStore();
  const [products, options] = await Promise.all([
    store.listProducts(), // 활성만
    store.listOptions(),
  ]);

  // v2.8 — 로그인 상태면 유저 닉네임으로 보내는 분(주문자) 성함을 프리필(선택, 수정 가능).
  // 세션·유저 조회 실패는 비회원으로 강등(주문 흐름에 영향 없음).
  const initialSenderName = await resolveNickname(store);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const productList: ProductLite[] = products.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // 활성 상품에 속하고 재고 있는(품절 아님) 옵션만 — listOptions 는 sortOrder 순
  const choices: OptionChoice[] = options
    .filter((o) => !o.soldOut && productMap.has(o.productId))
    .map((o) => {
      const product = productMap.get(o.productId)!;
      return {
        id: o.id,
        productId: o.productId,
        productName: product.name,
        name: o.name,
        description: o.description,
        price: o.price,
      };
    });

  return (
    <GiftOrderForm
      products={productList}
      options={choices}
      initialSenderName={initialSenderName}
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
