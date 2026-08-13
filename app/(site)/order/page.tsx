import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db';
import type { Coupon } from '@/lib/types';
import { getUserSession, kakaoConfigured } from '@/lib/user-auth';
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

  // v2.8/v2.9 — 로그인 상태면 닉네임 프리필 + 쿠폰·포인트를 넘긴다.
  // 세션·유저 조회 실패는 비회원으로 강등(주문 흐름에 영향 없음).
  const ctx = await resolveUserContext(store);

  return (
    <OrderForm
      productName={product.name}
      options={options}
      preselectedId={option.id}
      initialQuantity={initialQuantity}
      initialCustomerName={ctx.nickname}
      isLoggedIn={ctx.isLoggedIn}
      canLogin={kakaoConfigured()}
      coupons={ctx.coupons}
      pointsBalance={ctx.pointsBalance}
    />
  );
}

interface UserContext {
  isLoggedIn: boolean;
  nickname: string | undefined;
  coupons: Coupon[]; // 사용 가능한 쿠폰(ISSUED·미만료)만
  pointsBalance: number;
}

/**
 * 로그인 유저의 주문 컨텍스트(닉네임·쿠폰·포인트)를 모은다.
 * 카카오 미설정/비회원/조회 실패는 모두 비회원 컨텍스트로 강등한다.
 */
async function resolveUserContext(
  store: ReturnType<typeof getStore>
): Promise<UserContext> {
  const empty: UserContext = {
    isLoggedIn: false,
    nickname: undefined,
    coupons: [],
    pointsBalance: 0,
  };
  if (!kakaoConfigured()) return empty;
  try {
    const session = await getUserSession();
    if (!session) return empty;
    const user = await store.getUser(session.userId);
    if (!user) return empty;
    const all = await store.listCouponsByUser(user.id);
    const now = Date.now();
    const coupons = all.filter(
      (c) =>
        c.status === 'ISSUED' &&
        (!c.expiresAt || new Date(c.expiresAt).getTime() > now)
    );
    return {
      isLoggedIn: true,
      nickname: user.nickname?.trim() || undefined,
      coupons,
      pointsBalance: Math.max(0, user.points), // 음수 잔액은 0으로 표시·사용
    };
  } catch {
    return empty;
  }
}
