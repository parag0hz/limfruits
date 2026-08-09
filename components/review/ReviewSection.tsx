import Link from 'next/link';
import { getStore } from '@/lib/db';
import type { Review } from '@/lib/types';
import Stars from './Stars';
import { maskName } from './mask-name';

/** ISO → "2026.08.09" (한국 시간 기준) */
function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')}`;
}

/** DetailBlocks 와 동일한 URL 가드 — https:// 또는 / 로 시작하는 것만 렌더 */
function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('/');
}

/**
 * 상품 상세 "구매 후기" 섹션 (server component) —
 * 공개 GET API 없이 store 를 직접 읽는다. 최근 30개, VISIBLE 만.
 */
export default async function ReviewSection({
  productId,
}: {
  productId: string;
}) {
  // 요약(개수·평균)은 전체 기준으로 계산하고, 목록만 최근 30개를 보여준다.
  // 리뷰 조회 실패(예: reviews 테이블 미생성)가 상품 페이지 전체를 죽이면 안 된다 — 빈 목록으로 강등
  let all: Review[] = [];
  try {
    all = await getStore().listReviews({ productId });
  } catch (e) {
    console.error("[reviews] 목록 조회 실패 — 후기 섹션을 비웁니다:", e);
  }
  const count = all.length;
  const average =
    count > 0 ? all.reduce((sum, r) => sum + r.rating, 0) / count : 0;
  const reviews = all.slice(0, 30);

  return (
    <section aria-labelledby="reviews-heading">
      <h2
        id="reviews-heading"
        className="text-xl font-bold tracking-tight text-ink"
      >
        구매 후기
      </h2>

      {count === 0 ? (
        <div className="mt-4 rounded-2xl bg-surface px-5 py-10 text-center">
          <p className="text-base text-ink/85">
            아직 후기가 없습니다. 첫 후기를 남겨 주세요.
          </p>
          <p className="mt-2 text-sm text-muted">
            상품을 받으신 뒤{' '}
            <Link
              href="/order/lookup"
              className="font-medium text-brand underline underline-offset-2"
            >
              주문조회
            </Link>
            에서 작성하실 수 있습니다.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2">
            <Stars rating={average} />
            <span className="text-lg font-bold tabular-nums text-ink">
              {average.toFixed(1)}
            </span>
            <span className="text-sm text-muted">후기 {count}개</span>
          </div>

          <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
            {reviews.map((review) => {
              const photos = review.photos.filter(isSafeUrl);
              return (
                <li key={review.id} className="flex flex-col gap-3 py-6">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-sm font-medium text-ink">
                      {maskName(review.authorName)}
                    </span>
                    <span className="text-sm text-muted">
                      {formatReviewDate(review.createdAt)}
                    </span>
                    <Stars rating={review.rating} size="sm" />
                  </div>

                  {photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {photos.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                          aria-label={`후기 사진 ${i + 1} 원본 새 탭에서 보기`}
                        >
                          {/* Storage 공개 URL — 원격 도메인 설정 없이 img 로 렌더 */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            loading="lazy"
                            className="h-24 w-24 rounded-xl border border-hairline object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap text-base leading-7 text-ink/85">
                    {review.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
