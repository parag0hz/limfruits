"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReviewStatus } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Stars from "@/components/review/Stars";

interface Props {
  id: string;
  orderNo: string;
  productName: string;
  authorName: string; // 관리자 화면은 실명 그대로 표시
  rating: number;
  body: string;
  photos: string[];
  initialStatus: ReviewStatus;
  createdAtText: string;
}

/** 안전한 URL만 렌더 (javascript: 등 차단) — 상세 블록과 동일 규칙 */
function isSafeUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("/");
}

export default function ReviewCard({
  id,
  orderNo,
  productName,
  authorName,
  rating,
  body,
  photos,
  initialStatus,
  createdAtText,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ReviewStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleToggle() {
    if (busy) return;
    const next: ReviewStatus = status === "VISIBLE" ? "HIDDEN" : "VISIBLE";
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data?.error ?? "처리에 실패했습니다. 다시 시도해 주세요.",
        });
        return;
      }
      setStatus(next);
      setMessage({
        type: "success",
        text:
          next === "HIDDEN"
            ? "숨김 처리했습니다. 이제 사이트에 보이지 않습니다."
            : "다시 노출했습니다. 사이트에 보입니다.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    const confirmed = window.confirm(
      "이 리뷰를 삭제할까요?\n삭제하면 되돌릴 수 없습니다."
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data?.error ?? "삭제에 실패했습니다. 다시 시도해 주세요.",
        });
        return;
      }
      setDeleted(true);
    } catch {
      setMessage({
        type: "error",
        text: "연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (deleted) {
    return (
      <Card padding="sm" tone="light">
        <p role="status" className="text-lg font-semibold text-muted">
          리뷰를 삭제했습니다. ({productName} · {authorName})
        </p>
      </Card>
    );
  }

  const safePhotos = photos.filter(isSafeUrl);

  return (
    <Card padding="sm" id={`review-${id}`} className="scroll-mt-24">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-lg font-bold text-ink">
          {productName}
        </p>
        <Badge
          tone={status === "VISIBLE" ? "green" : "gray"}
          className="mt-0.5 shrink-0 text-base"
        >
          {status === "VISIBLE" ? "노출중" : "숨김"}
        </Badge>
      </div>

      <p className="mt-1 text-base text-muted">
        <span className="font-semibold text-ink">{authorName}</span>
        {" · "}
        {createdAtText}
      </p>
      <Link
        href={`/admin/orders/${orderNo}`}
        className="mt-0.5 inline-flex min-h-11 items-center text-base font-semibold text-brand-dark hover:underline"
      >
        주문 {orderNo} 보기
      </Link>

      {/* 스토어프론트와 동일한 SVG 별점 컴포넌트 재사용 (BRAND v2) */}
      <div className="mt-1 flex items-center gap-2">
        <Stars rating={rating} />
        <span
          aria-hidden="true"
          className="text-base font-bold text-ink tabular-nums"
        >
          {rating}점
        </span>
      </div>

      <p className="mt-2 text-lg leading-relaxed whitespace-pre-wrap text-ink">
        {body}
      </p>

      {safePhotos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {safePhotos.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0"
            >
              {/* 임의 저장소 URL이라 next/image 대신 일반 img 사용 (상세 블록과 동일) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`리뷰 사진 ${i + 1} (누르면 원본 열기)`}
                loading="lazy"
                className="h-24 w-24 rounded-xl border border-hairline object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {message && (
        <p
          role="status"
          className={
            message.type === "success"
              ? "mt-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-lg font-bold text-brand-dark"
              : "mt-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-lg font-bold text-danger"
          }
        >
          {message.text}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          size="lg"
          variant="outline"
          disabled={busy}
          onClick={handleToggle}
          className="flex-1 text-lg"
        >
          {busy ? "처리 중…" : status === "VISIBLE" ? "숨기기" : "보이게 하기"}
        </Button>
        <Button
          size="lg"
          variant="danger"
          disabled={busy}
          onClick={handleDelete}
          className="flex-1 text-lg"
        >
          삭제
        </Button>
      </div>
    </Card>
  );
}
