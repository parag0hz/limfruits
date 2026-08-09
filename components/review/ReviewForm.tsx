'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { STAR_PATH } from './Stars';

const MAX_PHOTOS = 3;
// Vercel 요청 본문 한도(4.5MB)를 넘지 않도록 클라이언트에서 장당 ~1MB로
// 리사이즈·재인코딩해 전송한다. 서버(app/api/reviews)의 한도와 맞춘 값:
// 장당 2MB, 총합 4MB.
const TARGET_PHOTO_BYTES = 1024 * 1024; // 압축 목표 (장당 ~1MB)
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 서버 장당 한도와 동일
const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 서버 총합 한도와 동일
const MAX_DIMENSION = 1600; // 긴 변 기준 리사이즈 상한(px)
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIN_BODY = 10;
const MAX_BODY = 2000;

interface PhotoDraft {
  file: File;
  previewUrl: string;
}

/** 파일을 비트맵으로 디코드. 실패 시 null (형식 미지원 등) */
async function loadBitmap(
  file: File
): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    // EXIF 회전 반영. 옵션 미지원 브라우저는 아래 폴백으로
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    /* 폴백 계속 */
  }
  try {
    return await createImageBitmap(file);
  } catch {
    /* 폴백 계속 */
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * 사진을 캔버스로 리사이즈·재인코딩해 장당 ~1MB로 줄인다.
 * 이미 충분히 작으면 원본 그대로. 한도(2MB) 안으로 줄이지 못하면 null.
 */
async function compressPhoto(file: File): Promise<File | null> {
  if (file.size <= TARGET_PHOTO_BYTES) return file;

  const fallback = file.size <= MAX_PHOTO_BYTES ? file : null;
  const source = await loadBitmap(file);
  if (!source) return fallback;

  const width =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!width || !height) return fallback;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return fallback;
  // png/webp 투명 영역은 흰색 배경으로 (JPEG 재인코딩 대비)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();

  let best: Blob | null = null;
  for (const quality of [0.85, 0.75, 0.65, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) break;
    best = blob;
    if (blob.size <= TARGET_PHOTO_BYTES) break;
  }
  // 재인코딩이 원본보다 커졌으면 원본(한도 이내일 때)을 쓴다
  if (!best || best.size >= file.size) return fallback;
  if (best.size > MAX_PHOTO_BYTES) return null;
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([best], `${baseName}.jpg`, { type: 'image/jpeg' });
}

interface DoneState {
  productId: string;
  photosSkipped: boolean;
}

export interface ReviewFormProps {
  /** 주문조회에 사용한 주문번호 (URL 이 아닌 state 로 전달받는다) */
  orderNo: string;
  /** 주문조회에 사용한 연락처 — 서버 검증용으로만 전송 */
  phone: string;
  onSuccess?: () => void;
  /** 이미 리뷰가 있는 주문(서버 409)일 때 */
  onDuplicate?: () => void;
  /** 폼 닫기(접기) — 전달되면 제출 버튼 옆에 닫기 버튼을 보여준다 */
  onClose?: () => void;
}

/** 별점 피커 — 터치 타깃 44px+ */
function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="별점" className="flex items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}점`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className="flex h-11 w-11 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="currentColor"
            className={`h-8 w-8 transition-colors ${
              n <= value ? 'text-brand' : 'text-hairline'
            }`}
          >
            <path d={STAR_PATH} />
          </svg>
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm font-medium tabular-nums text-muted">
          {value}점
        </span>
      )}
    </div>
  );
}

export default function ReviewForm({
  orderNo,
  phone,
  onSuccess,
  onDuplicate,
  onClose,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<DoneState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 언마운트 시 미리보기 object URL 정리
  const photosRef = useRef<PhotoDraft[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    },
    []
  );

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setPhotoError(null);
    const incoming = Array.from(list);
    const room = MAX_PHOTOS - photos.length;
    if (incoming.length > room) {
      setPhotoError(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
    }
    setPhotoBusy(true);
    try {
      let total = photos.reduce((sum, p) => sum + p.file.size, 0);
      const accepted: PhotoDraft[] = [];
      for (const file of incoming.slice(0, Math.max(room, 0))) {
        // 형식은 선택 즉시 확인 — 서버 매직 바이트 검증과 별개의 1차 안내
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setPhotoError('jpg, png, webp 형식의 사진만 첨부할 수 있습니다.');
          continue;
        }
        const processed = await compressPhoto(file);
        if (!processed) {
          setPhotoError(
            '사진 용량을 줄이지 못했습니다. 다른 사진을 선택해 주세요.'
          );
          continue;
        }
        if (total + processed.size > MAX_TOTAL_BYTES) {
          setPhotoError(
            '사진 용량 합계가 커서 더 첨부할 수 없습니다. 다른 사진을 선택해 주세요.'
          );
          continue;
        }
        total += processed.size;
        accepted.push({
          file: processed,
          previewUrl: URL.createObjectURL(processed),
        });
      }
      if (accepted.length > 0) {
        setPhotos((prev) => [...prev, ...accepted]);
      }
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    setPhotos((prev) => prev.filter((p) => p.previewUrl !== previewUrl));
    setPhotoError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const trimmedBody = body.trim();
    let hasError = false;
    if (rating < 1 || rating > 5) {
      setRatingError('별점을 선택해 주세요.');
      hasError = true;
    } else {
      setRatingError(null);
    }
    if (trimmedBody.length < MIN_BODY) {
      setBodyError(`후기를 ${MIN_BODY}자 이상 작성해 주세요.`);
      hasError = true;
    } else if (trimmedBody.length > MAX_BODY) {
      setBodyError(`후기는 ${MAX_BODY.toLocaleString()}자 이내로 작성해 주세요.`);
      hasError = true;
    } else {
      setBodyError(null);
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('orderNo', orderNo);
      formData.set('phone', phone);
      formData.set('rating', String(rating));
      formData.set('body', trimmedBody);
      photos.forEach((p) => formData.append('photos', p.file));

      const res = await fetch('/api/reviews', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        review?: { productId: string };
        photosSkipped?: boolean;
        error?: string;
      };

      if (res.status === 409) {
        setServerError(data.error ?? '이미 후기를 작성하신 주문입니다.');
        onDuplicate?.();
        return;
      }
      if (!res.ok || !data.review) {
        setServerError(
          data.error ?? '후기 등록 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }
      setDone({
        productId: data.review.productId,
        photosSkipped: data.photosSkipped === true,
      });
      onSuccess?.();
    } catch {
      setServerError('후기 등록 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div
        className="rounded-2xl bg-surface px-5 py-8 text-center"
        role="status"
      >
        <p className="text-base font-semibold text-ink">리뷰가 등록되었습니다</p>
        <p className="mt-1.5 text-sm text-muted">
          소중한 후기 감사합니다. 상품 페이지에서 확인하실 수 있습니다.
        </p>
        {done.photosSkipped && (
          <p className="mt-1.5 text-sm text-muted">
            데모 환경에서는 사진이 저장되지 않아 후기만 등록되었습니다.
          </p>
        )}
        <Link
          href={`/products/${encodeURIComponent(done.productId)}`}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          상품 페이지에서 후기 보기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* 별점 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          별점
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        </span>
        <StarPicker value={rating} onChange={(n) => { setRating(n); setRatingError(null); }} disabled={submitting} />
        {ratingError && (
          <p className="text-sm font-medium text-danger">{ratingError}</p>
        )}
      </div>

      {/* 본문 */}
      <div className="flex flex-col gap-1">
        <Textarea
          label="후기 내용"
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_BODY}
          disabled={submitting}
          placeholder="맛과 신선도, 포장 상태 등 받아 보신 상품에 대한 후기를 남겨 주세요. (10자 이상)"
          error={bodyError ?? undefined}
        />
        <p className="text-right text-sm tabular-nums text-muted">
          {body.length.toLocaleString()} / {MAX_BODY.toLocaleString()}자
        </p>
      </div>

      {/* 사진 */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">사진 (선택)</span>
        {photos.length > 0 && (
          <ul className="flex gap-2">
            {photos.map((p, i) => (
              <li key={p.previewUrl} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.previewUrl}
                  alt={`첨부한 사진 ${i + 1} 미리보기`}
                  className="h-20 w-20 rounded-xl border border-hairline object-cover"
                />
                {/* 시각 크기는 28px 유지, 터치 영역은 가상요소로 44px 확보 */}
                <button
                  type="button"
                  aria-label={`사진 ${i + 1} 제거`}
                  disabled={submitting}
                  onClick={() => removePhoto(p.previewUrl)}
                  className="absolute -right-2 -top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-hairline bg-white text-ink shadow-sm transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-surface disabled:cursor-not-allowed"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = ''; // 같은 파일 재선택 허용
          }}
        />
        <div>
          <Button
            variant="outline"
            disabled={submitting || photoBusy || photos.length >= MAX_PHOTOS}
            onClick={() => fileInputRef.current?.click()}
          >
            {photoBusy ? '사진 처리 중…' : '사진 추가'}
          </Button>
        </div>
        {photoError ? (
          <p className="text-sm font-medium text-danger">{photoError}</p>
        ) : (
          <p className="text-sm text-muted">
            최대 {MAX_PHOTOS}장 · jpg, png, webp · 용량이 큰 사진은 자동으로
            줄여서 첨부됩니다
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          size="lg"
          disabled={submitting || photoBusy}
          className="flex-1"
        >
          {submitting ? '등록 중…' : '후기 등록하기'}
        </Button>
        {onClose && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={submitting}
            onClick={onClose}
          >
            닫기
          </Button>
        )}
      </div>
      {serverError && (
        <p
          className="rounded-xl bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
          role="alert"
        >
          {serverError}
        </p>
      )}
    </form>
  );
}
