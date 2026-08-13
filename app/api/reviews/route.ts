import { NextResponse } from 'next/server';
import { getStore, ReviewExistsError } from '@/lib/db';
import { REVIEW_POINT } from '@/lib/coupon-points';
import { uploadReviewPhoto } from '@/lib/storage';
import { normalizePhone } from '@/lib/format';
import type { Review } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_PHOTOS = 3;
// Vercel 서버리스 함수의 요청 본문 한도가 4.5MB라 5MB 허용은 운영 환경에서
// 라우트 도달 전에 413으로 차단된다. 클라이언트(ReviewForm)가 장당 ~1MB로
// 리사이즈·재인코딩해 보내고, 서버는 장당 2MB · 총합 4MB로 제한한다.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 장당 2MB
const MAX_TOTAL_PHOTO_BYTES = 4 * 1024 * 1024; // 총합 4MB (Vercel 4.5MB 이내)
const MIN_BODY = 10;
const MAX_BODY = 2000;

function errorJson(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Content-Type 헤더는 위조 가능하므로 믿지 않고, 파일 앞부분 매직 바이트로
 * 실제 이미지 형식(jpeg/png/webp)을 판별한다. SPEC v2.2 부록.
 * - JPEG: FF D8
 * - PNG:  89 50 4E 47 0D 0A 1A 0A (정식 시그니처 8바이트 전체)
 * - WEBP: "RIFF" .... "WEBP"
 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((b, i) => bytes[i] === b)
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'image/webp';
  }
  return null;
}

/** phone 은 검증용 개인정보 — API 응답에 절대 포함하지 않는다 (allowlist 방식) */
function toPublicReview(r: Review) {
  return {
    id: r.id,
    productId: r.productId,
    orderNo: r.orderNo,
    authorName: r.authorName,
    rating: r.rating,
    body: r.body,
    photos: r.photos,
    status: r.status,
    createdAt: r.createdAt,
  };
}

/**
 * 구매자 포토 리뷰 등록 (multipart FormData: orderNo, phone, rating, body, photos)
 * 검증 순서는 SPEC v2.2 부록 그대로:
 * ① 주문 인증(404) ② 상태 SHIPPING/DONE(400) ③ 중복(409) ④ 별점·본문(400) ⑤ 사진(400)
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorJson(
      '요청 형식이 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.',
      400
    );
  }

  const orderNo = String(form.get('orderNo') ?? '')
    .trim()
    .toUpperCase();
  const phone = normalizePhone(String(form.get('phone') ?? ''));
  const ratingRaw = String(form.get('rating') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();
  // 필드명은 photos 기준. photos[] 로 보내는 클라이언트도 수용
  const photoEntries = [...form.getAll('photos'), ...form.getAll('photos[]')];

  if (!orderNo) {
    return errorJson('주문번호를 입력해 주세요.', 400);
  }
  if (phone.length < 10 || phone.length > 11) {
    return errorJson('주문하실 때 입력하신 연락처를 정확히 입력해 주세요.', 400);
  }

  const store = getStore();

  // ① 주문번호 + 전화번호 인증 (주문조회와 동일)
  const order = await store.findOrder(orderNo, phone);
  if (!order) {
    return errorJson(
      '주문을 찾지 못했어요. 주문번호와 연락처를 다시 확인해 주세요.',
      404
    );
  }

  // ② 수령 후에만 작성 가능
  if (order.status !== 'SHIPPING' && order.status !== 'DONE') {
    return errorJson('상품을 받으신 뒤 작성할 수 있습니다.', 400);
  }

  // ③ 주문 1건당 리뷰 1개
  const existing = await store.getReviewByOrderNo(order.orderNo);
  if (existing) {
    return errorJson('이미 후기를 작성하신 주문입니다.', 409);
  }

  // ④ 별점·본문
  const rating = Number(ratingRaw);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return errorJson('별점을 1점부터 5점까지 선택해 주세요.', 400);
  }
  if (body.length < MIN_BODY || body.length > MAX_BODY) {
    return errorJson(
      `후기는 ${MIN_BODY}자 이상 ${MAX_BODY}자 이내로 작성해 주세요.`,
      400
    );
  }

  // ⑤ 사진 — 개수 → 용량 → 매직 바이트 순으로 검증
  //    (브라우저가 빈 input 을 함께 보내는 경우의 빈 파일 항목은 무시)
  const files = photoEntries.filter(
    (entry): entry is File =>
      entry instanceof File && !(entry.size === 0 && entry.name === '')
  );
  if (files.length > MAX_PHOTOS) {
    return errorJson(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있습니다.`, 400);
  }
  const validated: { bytes: ArrayBuffer; contentType: ImageType }[] = [];
  let totalBytes = 0;
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) {
      return errorJson('사진은 한 장에 2MB 이하만 올릴 수 있습니다.', 400);
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_PHOTO_BYTES) {
      return errorJson(
        '사진 용량 합계는 4MB 이하여야 합니다. 사진 수를 줄이거나 용량이 작은 사진으로 올려 주세요.',
        400
      );
    }
    const bytes = await file.arrayBuffer();
    const contentType = sniffImageType(new Uint8Array(bytes));
    if (!contentType) {
      return errorJson('jpg, png, webp 형식의 사진만 올릴 수 있습니다.', 400);
    }
    validated.push({ bytes, contentType });
  }

  // 사진 업로드 — 데모 모드(Supabase 미설정)면 null 이 반환되므로 사진 없이 등록
  const photos: string[] = [];
  let photosSkipped = false;
  try {
    for (let i = 0; i < validated.length; i++) {
      const url = await uploadReviewPhoto(order.orderNo, i, validated[i]);
      if (url === null) {
        photosSkipped = true;
        break;
      }
      photos.push(url);
    }
  } catch (e) {
    console.error('[limfruits] 리뷰 사진 업로드 실패:', e);
    return errorJson(
      '사진 업로드 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      500
    );
  }

  const productId = order.items[0]?.productId;
  if (!productId) {
    return errorJson(
      '주문 상품 정보를 확인할 수 없습니다. 판매자에게 문의해 주세요.',
      500
    );
  }

  let review: Review;
  try {
    review = await store.createReview({
      productId,
      orderNo: order.orderNo,
      authorName: order.customerName,
      phone: order.phone,
      rating,
      body,
      photos,
    });
  } catch (e) {
    // ③ 이후 동시 요청으로 unique(order_no) 위반이 난 경우
    if (e instanceof ReviewExistsError) {
      return errorJson('이미 후기를 작성하신 주문입니다.', 409);
    }
    throw e;
  }

  // v2.9 — 포토리뷰 적립: 로그인(회원) 주문이고 사진이 있을 때 1,000P.
  // 리뷰는 주문당 1개(unique)라 적립도 1회. 적립 실패는 리뷰 등록을 되돌리지 않는다.
  let pointsEarned = 0;
  if (order.userId && photos.length > 0) {
    try {
      // 적립 직전 최신 주문 상태 재확인 — 사진 업로드(느림) 사이 관리자가 취소했다면
      // 취소된 주문에 적립이 남는 경합을 막는다(리뷰 자체는 유지).
      const fresh = await store.getOrderByNo(order.orderNo);
      if (fresh && fresh.status !== 'CANCELED') {
        await store.grantReviewPoints(order.userId, order.orderNo);
        pointsEarned = REVIEW_POINT;
      }
    } catch (pErr) {
      console.error('[limfruits] 리뷰 적립 실패(리뷰는 유지):', pErr);
    }
  }

  return NextResponse.json(
    {
      review: toPublicReview(review),
      ...(photosSkipped ? { photosSkipped: true } : {}),
      ...(pointsEarned > 0 ? { pointsEarned } : {}),
    },
    { status: 201 }
  );
}
