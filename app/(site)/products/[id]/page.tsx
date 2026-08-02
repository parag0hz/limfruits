import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getStore } from '@/lib/db';
import BuyPanel, {
  BuyBar,
  BuyPanelProvider,
} from '@/components/product/BuyPanel';

export const dynamic = 'force-dynamic';

async function getActiveProduct(rawId: string) {
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    // 원문 그대로 사용
  }
  const product = await getStore().getProduct(id);
  if (!product || !product.isActive) return null;
  return product;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getActiveProduct(id);
  if (!product) return { title: '상품을 찾을 수 없습니다' };
  return {
    title: product.name,
    description: product.subtitle || `${product.name} — 임과일 산지 직송`,
  };
}

/** 대표이미지가 없을 때 — 서피스 배경에 로고 일러스트 placeholder */
function ImagePlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface">
      <Image
        src="/logo.jpeg"
        alt=""
        width={667}
        height={667}
        priority
        className="h-24 w-24 rounded-2xl object-cover opacity-90 sm:h-28 sm:w-28"
      />
    </div>
  );
}

const SHIPPING_NOTES = [
  '결제 확인 후 나주 산지에서 포장해 택배로 발송합니다.',
  '수확·주문 상황에 따라 발송까지 며칠 걸릴 수 있으며, 주문 순서대로 발송합니다.',
  '표시된 가격에 배송비가 포함되어 있습니다.',
  '제주·도서산간 지역은 배송이 1~2일 더 걸릴 수 있습니다.',
];

const REFUND_NOTES = [
  '신선식품 특성상 단순 변심에 의한 교환·환불은 어렵습니다.',
  '배송 중 파손되었거나 상품에 하자가 있는 경우, 수령 당일 사진과 함께 연락해 주세요.',
  '확인 후 재발송 또는 환불로 처리해 드립니다.',
];

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getActiveProduct(id);
  if (!product) notFound();

  const options = await getStore().listOptions(product.id);
  const paragraphs = product.detail
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <BuyPanelProvider options={options}>
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:pt-10 lg:pb-16">
        {/* 상단: 이미지 + 구매 패널 */}
        <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-12">
          <div className="overflow-hidden rounded-2xl border border-hairline">
            <div className="relative aspect-square w-full">
              {product.imageUrl ? (
                // 관리자가 입력하는 외부 URL이라 next/image 원격 도메인 설정 없이 img로 렌더
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImagePlaceholder />
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <BuyPanel productName={product.name} subtitle={product.subtitle} />
          </div>
        </div>

        {/* 하단: 상세 정보 */}
        <div className="mt-14 flex max-w-3xl flex-col gap-12 lg:mt-20">
          {paragraphs.length > 0 && (
            <section aria-labelledby="product-detail-heading">
              <h2
                id="product-detail-heading"
                className="text-xl font-bold tracking-tight text-ink"
              >
                상품 정보
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {paragraphs.map((paragraph, i) => (
                  <p key={i} className="text-base leading-7 text-ink/85">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="shipping-heading">
            <h2
              id="shipping-heading"
              className="text-xl font-bold tracking-tight text-ink"
            >
              배송 안내
            </h2>
            <ul className="mt-4 flex flex-col gap-2 text-base leading-7 text-ink/85">
              {SHIPPING_NOTES.map((note) => (
                <li key={note} className="flex gap-2">
                  <span aria-hidden className="text-muted">
                    ·
                  </span>
                  {note}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="refund-heading">
            <h2
              id="refund-heading"
              className="text-xl font-bold tracking-tight text-ink"
            >
              교환·환불 안내
            </h2>
            <ul className="mt-4 flex flex-col gap-2 text-base leading-7 text-ink/85">
              {REFUND_NOTES.map((note) => (
                <li key={note} className="flex gap-2">
                  <span aria-hidden className="text-muted">
                    ·
                  </span>
                  {note}
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="contact-heading"
            className="rounded-2xl bg-surface p-5 sm:p-6"
          >
            <h2 id="contact-heading" className="text-base font-semibold text-ink">
              문의
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              주문·배송 관련 문의는 전화로 받습니다.{' '}
              <a
                href="tel:010-0000-0000"
                className="font-medium text-ink underline underline-offset-2"
              >
                010-OOOO-OOOO
              </a>
            </p>
          </section>
        </div>

        {/* 모바일 하단 구매 바 — 컨테이너 마지막 요소의 sticky로 두어
            문서 끝에서 푸터(관리자 링크·저작권 줄)가 온전히 드러난다 */}
        <BuyBar />
      </div>
    </BuyPanelProvider>
  );
}
