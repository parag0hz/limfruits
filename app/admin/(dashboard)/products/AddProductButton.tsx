"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

/**
 * "+ 상품 추가" — 누르면 이름 입력 폼이 열리고,
 * 만들기를 누르면 상품이 생성된 뒤 바로 편집 화면으로 이동한다.
 */
export default function AddProductButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (creating) return;
    if (name.trim() === "") {
      setError("상품 이름을 입력해 주세요.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        product?: Product;
      } | null;
      if (!res.ok || !data?.product) {
        setError(data?.error ?? "상품을 만들지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      router.push(`/admin/products/${data.product.id}`);
    } catch {
      setError("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCreating(false);
    }
  }

  if (!open) {
    return (
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="w-full text-xl"
      >
        + 상품 추가
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleCreate();
      }}
      className="rounded-2xl border border-hairline bg-white p-4 sm:p-5"
    >
      <p className="text-lg font-bold text-ink">새 상품 이름을 입력해 주세요</p>
      <p className="mt-0.5 text-base text-muted">
        사진과 가격은 다음 화면에서 입력합니다.
      </p>
      <div className="mt-3">
        <Input
          label="상품 이름"
          labelHidden
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="예: 사과"
          autoFocus
          className="text-lg"
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-base font-bold text-danger">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          type="submit"
          size="lg"
          disabled={creating}
          className="flex-1 text-lg"
        >
          {creating ? "만드는 중..." : "만들기"}
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={creating}
          onClick={() => {
            setOpen(false);
            setName("");
            setError(null);
          }}
          className="px-5 text-lg"
        >
          취소
        </Button>
      </div>
    </form>
  );
}
