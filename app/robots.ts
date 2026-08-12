import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/components/seo/schema';

/**
 * 크롤러 접근 규칙. 공개 페이지는 허용하고, 관리자·API·결제 결과 경로는 차단한다.
 * (결제 성공/실패/완료 페이지는 주문번호가 담긴 일회성 경로라 색인 대상이 아니다.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api',
        '/order/success',
        '/order/fail',
        '/order/complete',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    // Host 지시어는 스킴 없는 호스트명만 받는다(https:// 붙으면 형식 오류).
    host: new URL(SITE_URL).host,
  };
}
