"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PriceField, { parsePriceText } from "./PriceField";

/**
 * "+ 옵션 추가" — 누르면 이름/설명/가격 입력 폼이 열리고,
 * 추가하면 목록에 바로 나타난다.
 */
export default function AddOptionForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { price, valid: priceValid } = parsePriceText(priceText);

  function reset() {
    setName("");
    setDescription("");
    setPriceText("");
    setError(null);
  }

  async function handleCreate() {
    if (creating) return;
    if (name.trim() === "") {
      setError("옵션 이름을 입력해 주세요.");
      return;
    }
    if (!priceValid) {
      setError("가격은 1원 이상의 숫자로 입력해 주세요.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          name: name.trim(),
          description: description.trim(),
          price,
        }),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "옵션을 추가하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCreating(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="lg"
        onClick={() => setOpen(true)}
        className="w-full text-lg"
      >
        + 옵션 추가
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
      <p className="text-lg font-bold text-ink">새 옵션</p>
      <p className="mt-0.5 text-base text-muted">
        무게나 구성별로 가격을 나눠 등록합니다.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <Input
          label="옵션 이름"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="예: 가정용 3kg"
          autoFocus
        />
        <Input
          label="설명 (선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 5~7과 · 실속 가정용"
        />
        <PriceField
          id="new-option-price"
          value={priceText}
          onChange={(v) => {
            setPriceText(v);
            setError(null);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-base font-bold text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          type="submit"
          size="lg"
          disabled={creating}
          className="flex-1 text-lg"
        >
          {creating ? "추가 중..." : "옵션 추가"}
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={creating}
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="px-5 text-lg"
        >
          취소
        </Button>
      </div>
    </form>
  );
}
