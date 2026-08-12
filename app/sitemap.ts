import type { MetadataRoute } from 'next';
import { getStore } from '@/lib/db';
import { SITE_URL } from '@/components/seo/schema';

/**
 * 활성 상품이 바뀌면 사이트맵에도 반영되도록 항상 최신으로 생성한다
 * (홈·상품 상세와 동일한 동적 정책). listProducts() 는 기본적으로 활성 상품만 반환.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  // 활성 상품 상세 — 조회 실패가 사이트맵 전체를 막지 않도록 강등한다.
  try {
    const products = await getStore().listProducts();
    for (const product of products) {
      entries.push({
        url: `${SITE_URL}/products/${encodeURIComponent(product.id)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch (e) {
    console.error('[sitemap] 상품 목록 조회 실패 — 정적 경로만 포함합니다:', e);
  }

  entries.push(
    {
      url: `${SITE_URL}/order/gift`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/order/lookup`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    }
  );

  return entries;
}
