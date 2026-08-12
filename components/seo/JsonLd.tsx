import type { ReactElement } from 'react';

/**
 * JSON-LD 구조화 데이터를 <script type="application/ld+json"> 로 렌더한다.
 * 서버에서 생성한 정적 객체(또는 객체 배열)만 넘긴다.
 *
 * XSS 안전: JSON.stringify 후 '<' 를 유니코드 이스케이프(<)로 치환한다.
 * 이로써 문자열 값에 '</script>' 나 '<!--' 가 들어와도 스크립트 컨텍스트를
 * 벗어날 수 없다. JSON 파서는 < 를 '<' 로 정상 복원하므로 데이터는 온전하다.
 */
export default function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}): ReactElement {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
