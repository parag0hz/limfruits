import type { Product, ProductOption } from '@/lib/types';

/**
 * 사이트 절대 URL 기준값. layout 의 metadataBase 와 동일한 소스를 쓴다.
 * sitemap/robots/JSON-LD 는 반드시 절대 URL 이어야 하므로 여기서 한 번만 계산한다.
 * 끝의 슬래시는 제거해 `${SITE_URL}/path` 조합이 이중 슬래시가 되지 않게 한다.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

/** 내부 경로/외부 URL 을 절대 URL 로. 이미 http(s) 면 그대로 둔다. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * 상품 대표 이미지(외부 URL·상대경로·null)를 절대 URL 로.
 * 없거나 형식 불명이면 브랜드 로고로 폴백한다(구조화 데이터에 깨진 URL 방지).
 */
export function absoluteImage(url: string | null | undefined): string {
  if (!url) return `${SITE_URL}/logo.jpeg`;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${SITE_URL}${url}`;
  return `${SITE_URL}/logo.jpeg`;
}

/** 확정 사업자 정보 (SPEC v2.7 부록 — 지어내지 말 것). */
export const BUSINESS = {
  brand: '임과일',
  legalName: '풍천대봉감농원',
  phone: '+82-10-2618-5151',
  addressRegion: '전라남도',
  addressLocality: '나주시',
  streetAddress: '덕룡로 33-8',
} as const;

type JsonLdObject = Record<string, unknown>;

/** 홈에 1회 노출하는 판매 주체 정보. */
export function organizationSchema(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BUSINESS.brand,
    legalName: BUSINESS.legalName,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.jpeg`,
    image: `${SITE_URL}/logo.jpeg`,
    telephone: BUSINESS.phone,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
      addressRegion: BUSINESS.addressRegion,
      addressLocality: BUSINESS.addressLocality,
      streetAddress: BUSINESS.streetAddress,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: BUSINESS.phone,
      contactType: 'customer service',
      areaServed: 'KR',
      availableLanguage: 'Korean',
    },
  };
}

/** 사이트 자체를 나타내는 WebSite 노드. */
export function webSiteSchema(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BUSINESS.brand,
    url: SITE_URL,
    inLanguage: 'ko-KR',
  };
}

/**
 * 상품 상세용 Product 구조화 데이터.
 * offers: 옵션이 여러 개면 AggregateOffer(lowPrice/highPrice), 단일이면 Offer.
 * 재고가 하나라도 있으면 InStock, 전부 품절이면 OutOfStock (실제 값만).
 * 리뷰가 있으면 aggregateRating 포함(평균은 소수 1자리).
 */
export function productSchema(params: {
  product: Product;
  options: ProductOption[];
  reviewCount: number;
  reviewAverage: number;
}): JsonLdObject {
  const { product, options, reviewCount, reviewAverage } = params;
  const url = `${SITE_URL}/products/${encodeURIComponent(product.id)}`;

  const schema: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.subtitle || `${product.name} — 임과일 산지 직송`,
    image: [absoluteImage(product.imageUrl)],
    brand: { '@type': 'Brand', name: BUSINESS.brand },
    url,
  };

  const prices = options
    .map((o) => o.price)
    .filter((p) => Number.isFinite(p) && p > 0);

  if (prices.length > 0) {
    const availability = options.some((o) => !o.soldOut)
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock';
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    schema.offers =
      low === high
        ? {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: low,
            availability,
            url,
          }
        : {
            '@type': 'AggregateOffer',
            priceCurrency: 'KRW',
            lowPrice: low,
            highPrice: high,
            offerCount: prices.length,
            availability,
            url,
          };
  }

  if (reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviewAverage.toFixed(1),
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}
