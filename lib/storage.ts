/*
 * Supabase Storage REST 헬퍼 — 리뷰 사진 업로드/삭제 (v2.2).
 *
 * 인증 주의: 이 프로젝트의 서비스 롤 키(sb_secret_...)는 Storage API의
 * `Authorization: Bearer` JWT 파싱에서 거부된다. 반드시 `apikey` 헤더로만
 * 인증한다 (이 프로젝트에서 이미 검증된 사실 — SPEC v2.2 부록 참고).
 *
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정(인메모리 데모 모드)이면
 * uploadReviewPhoto는 null을 반환하고 deleteReviewPhotos는 아무 것도 하지 않는다.
 */

const BUCKET = 'reviews';

function getConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

/** API가 매직 바이트로 확인하는 세 형식만 취급. 그 외는 확장자 bin */
function extFromContentType(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

/**
 * 버킷 'reviews'(public) 생성 시도 — 신규 설치에서도 자동 동작.
 * 이미 있으면(409/중복) 무시. 그 밖의 실패도 업로드 시도는 계속한다
 * (진짜 문제라면 업로드 에러로 드러난다).
 */
async function ensureBucket(cfg: { url: string; key: string }): Promise<void> {
  try {
    const res = await fetch(`${cfg.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
    if (res.ok || res.status === 409) return;
    const text = await res.text().catch(() => '');
    if (/exist|duplicate/i.test(text)) return; // 이미 있음 — 무시
    console.warn(
      `[limfruits] reviews 버킷 생성 실패(업로드는 계속 시도): ${res.status} ${text}`
    );
  } catch (e) {
    console.warn('[limfruits] reviews 버킷 생성 요청 실패(업로드는 계속 시도):', e);
  }
}

/**
 * 리뷰 사진 업로드 → 공개 URL 반환.
 * 경로: reviews/{orderNo}/{uuid}-{index}.{ext}
 * 요청별 랜덤 세그먼트(uuid)를 넣고 upsert 를 쓰지 않는다 — 같은 주문의
 * 동시 중복 제출(unique 제약 발동 전)이 서로의 사진을 덮어쓰지 못하게 함.
 * 삭제는 폴더(reviews/{orderNo}/) 단위라 고아 파일도 함께 정리된다.
 * 데모 모드(Supabase 미설정)면 null 반환 — 호출부에서 사진 없이 진행.
 * 업로드 실패는 throw.
 */
export async function uploadReviewPhoto(
  orderNo: string,
  index: number,
  file: { bytes: ArrayBuffer; contentType: string }
): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg) return null;

  await ensureBucket(cfg);

  const path = `${encodeURIComponent(
    orderNo
  )}/${crypto.randomUUID()}-${index}.${extFromContentType(file.contentType)}`;
  const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      'Content-Type': file.contentType,
    },
    body: file.bytes,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`리뷰 사진 업로드 실패 (${res.status}): ${text}`);
  }
  return `${cfg.url}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * 해당 주문의 리뷰 사진 폴더(reviews/{orderNo}/) 전체 삭제 시도.
 * 베스트 에포트 — 실패해도 throw 하지 않는다 (리뷰 행 삭제는 계속 진행,
 * SPEC v2.2 부록의 관리자 DELETE 동작).
 */
export async function deleteReviewPhotos(orderNo: string): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;

  try {
    // 폴더 내 객체 목록 조회
    const listRes = await fetch(`${cfg.url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: orderNo, limit: 100 }),
    });
    if (!listRes.ok) {
      console.warn(
        `[limfruits] 리뷰 사진 목록 조회 실패(삭제 생략): ${listRes.status}`
      );
      return;
    }
    const objects = (await listRes.json()) as { name: string }[];
    const prefixes = objects
      .filter((o) => o && typeof o.name === 'string' && o.name.length > 0)
      .map((o) => `${orderNo}/${o.name}`);
    if (prefixes.length === 0) return;

    const delRes = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: {
        apikey: cfg.key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes }),
    });
    if (!delRes.ok) {
      const text = await delRes.text().catch(() => '');
      console.warn(
        `[limfruits] 리뷰 사진 삭제 실패(무시): ${delRes.status} ${text}`
      );
    }
  } catch (e) {
    console.warn('[limfruits] 리뷰 사진 삭제 요청 실패(무시):', e);
  }
}
