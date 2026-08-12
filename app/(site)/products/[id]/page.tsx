import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore } from '@/lib/db';
import type { Review } from '@/lib/types';
import BuyPanel, {
  BuyBar,
  BuyPanelProvider,
} from '@/components/product/BuyPanel';
import DetailBlocks from '@/components/product/DetailBlocks';
import ReviewSection from '@/components/review/ReviewSection';
import { buttonClasses } from '@/components/ui/Button';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteImage, productSchema } from '@/components/seo/schema';

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
  if (!product)
    return {
      title: '상품을 찾을 수 없습니다',
      robots: { index: false, follow: false },
    };
  const description = product.subtitle || `${product.name} — 임과일 산지 직송`;
  const canonical = `/products/${encodeURIComponent(product.id)}`;
  // 대표 이미지가 있으면 그것을, 없으면 로고를 OG 이미지로. (절대 URL 로 확정)
  const ogImage = absoluteImage(product.imageUrl);
  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      title: product.name,
      description,
      url: canonical,
      images: [ogImage],
      siteName: '임과일',
      locale: 'ko_KR',
      type: 'website',
    },
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

  // 리뷰는 상단 요약(BuyPanel)과 하단 후기 섹션(ReviewSection)이 함께 쓰므로
  // 페이지에서 한 번만 조회해 양쪽에 넘긴다(중복 쿼리 방지).
  // 리뷰 조회 실패가 상품 페이지 전체를 죽이면 안 되므로 실패 시 빈 목록으로 강등한다.
  const [options, reviews] = await Promise.all([
    getStore().listOptions(product.id),
    getStore()
      .listReviews({ productId: product.id })
      .catch((e) => {
        console.error('[product] 리뷰 조회 실패 — 후기 없이 렌더합니다:', e);
        return [] as Review[];
      }),
  ]);
  const reviewCount = reviews.length;
  // 원 평균(반올림 전)을 상단 요약에 넘긴다. 여기서 소수 1자리로 먼저 반올림하면
  // Stars 가 다시 정수 반올림하며(이중 반올림) 하단 후기 섹션과 별 개수가 어긋난다.
  // 숫자 표기(toFixed(1))·별 채움 모두 하단 ReviewSection 과 동일하게 원 평균 기준으로 한다.
  const reviewAverage =
    reviewCount > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : 0;
  const hasBlocks = product.blocks.length > 0;
  // blocks 가 비어 있을 때만 쓰는 (구) detail 문단 폴백
  const paragraphs = hasBlocks
    ? []
    : product.detail
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

  return (
    <BuyPanelProvider options={options}>
      {/* 카드뉴스 섹션의 풀블리드 배경을 위해 바깥 래퍼는 풀폭으로 두고,
          내용 단위로 max-w-5xl 컬럼을 준다. BuyBar 는 이 래퍼의 마지막
          요소여야 sticky 가 페이지 끝까지 동작한다 */}
      <div className="w-full">
        {/* 구조화 데이터 — Product(가격·재고·리뷰 요약). 렌더에 영향 없는 script 노드 */}
        <JsonLd
          data={productSchema({
            product,
            options,
            reviewCount,
            reviewAverage,
          })}
        />

        {/* 상단: 이미지 + 구매 패널 */}
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:pt-10">
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
              <BuyPanel
                productName={product.name}
                subtitle={product.subtitle}
                reviewCount={reviewCount}
                reviewAverage={reviewAverage}
              />
              <div className="mt-4 border-t border-hairline pt-4">
                <Link
                  href="/order/gift"
                  className={buttonClasses('outline', 'md', 'w-full')}
                >
                  선물·대량 주문
                </Link>
                <p className="mt-2 text-center text-xs text-muted">
                  여러 곳에 한 번에 · 엑셀로 대량 주문
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 카드뉴스형 상세 블록 — heading 경계로 white/surface 풀블리드 교차 */}
        {hasBlocks && (
          <div className="mt-14 lg:mt-20">
            <DetailBlocks blocks={product.blocks} />
          </div>
        )}

        {/* 구매 후기 — v2.2. 상세 블록 아래, 배송 안내 위.
            id="reviews": 상단 리뷰 요약(BuyPanel)의 앵커 대상. 헤더 sticky 만큼 scroll-mt 확보 */}
        <div
          id="reviews"
          className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 pt-14 sm:px-6 lg:pt-16"
        >
          <div className="max-w-3xl">
            <ReviewSection productId={product.id} reviews={reviews} />
          </div>
        </div>

        {/* 하단: 배송·환불·문의 안내 (blocks 비면 detail 문단 폴백 포함) */}
        <div
          className={`mx-auto w-full max-w-5xl px-4 sm:px-6 lg:pb-16 ${
            hasBlocks ? 'pt-14 lg:pt-16' : 'pt-14 lg:pt-20'
          }`}
        >
          <div className="flex max-w-3xl flex-col gap-12">
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
              <h2
                id="contact-heading"
                className="text-base font-semibold text-ink"
              >
                문의
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                주문·배송 관련 문의는 전화로 받습니다.{' '}
                <a
                  href="tel:010-2618-5151"
                  className="font-medium text-ink underline underline-offset-2"
                >
                  010-2618-5151
                </a>
              </p>
            </section>
          </div>
        </div>

        {/* 모바일 하단 구매 바 — 페이지 흐름 마지막 요소의 sticky로 두어
            문서 끝에서 푸터(관리자 링크·저작권 줄)가 온전히 드러난다 */}
        <BuyBar />
      </div>
    </BuyPanelProvider>
  );
}
