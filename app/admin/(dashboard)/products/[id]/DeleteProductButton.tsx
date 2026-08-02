"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

/**
 * 상품 삭제 — 2단계 확인.
 * 1단계: '이 상품 삭제' 버튼 → 확인 패널 열림
 * 2단계: 패널 안에서 '삭제 확정'을 눌러야 실제로 삭제
 * 삭제 후에는 상품 목록으로 돌아간다.
 */
export default function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "삭제에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      router.replace("/admin/products");
      router.refresh();
    } catch {
      setError("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="danger"
        size="lg"
        onClick={() => setOpen(true)}
        className="w-full text-lg"
      >
        이 상품 삭제
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-danger/50 bg-danger/5 p-4 sm:p-5">
      <p className="text-lg font-bold text-danger">
        &lsquo;{productName}&rsquo; 상품을 정말 삭제할까요?
      </p>
      <p className="mt-1 text-base text-ink">
        옵션도 함께 삭제됩니다. 기존 주문 내역은 사라지지 않습니다.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-base font-bold text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="lg"
          disabled={deleting}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="flex-1 text-lg"
        >
          취소
        </Button>
        <Button
          variant="danger"
          size="lg"
          disabled={deleting}
          onClick={handleDelete}
          className="flex-1 text-lg"
        >
          {deleting ? "삭제 중..." : "삭제 확정"}
        </Button>
      </div>
    </div>
  );
}
