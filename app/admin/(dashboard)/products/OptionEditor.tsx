"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductOption } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { formatWon } from "@/lib/format";

export default function OptionEditor({ option }: { option: ProductOption }) {
  const router = useRouter();
  const [name, setName] = useState(option.name);
  const [description, setDescription] = useState(option.description);
  const [priceText, setPriceText] = useState(String(option.price));
  const [soldOut, setSoldOut] = useState(option.soldOut);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const price = Number(priceText.replace(/[^\d]/g, "") || "0");
  const priceValid = Number.isInteger(price) && price > 0;

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (type === "success") {
      timerRef.current = setTimeout(() => setMessage(null), 3000);
    }
  }

  async function patchOption(
    body: Record<string, unknown>
  ): Promise<boolean> {
    const res = await fetch(`/api/admin/options/${option.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      router.replace("/admin/login");
      return false;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      showMessage(
        "error",
        data?.error ?? "저장에 실패했습니다. 다시 시도해 주세요."
      );
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (saving) return;
    if (name.trim() === "") {
      showMessage("error", "옵션 이름을 입력해 주세요.");
      return;
    }
    if (!priceValid) {
      showMessage("error", "가격은 1원 이상의 숫자로 입력해 주세요.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const ok = await patchOption({
        name: name.trim(),
        description: description.trim(),
        price,
      });
      if (ok) {
        showMessage("success", "저장되었습니다.");
        router.refresh();
      }
    } catch {
      showMessage("error", "연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSoldOut() {
    if (toggling) return;
    const next = !soldOut;
    setToggling(true);
    setMessage(null);
    try {
      const ok = await patchOption({ soldOut: next });
      if (ok) {
        setSoldOut(next);
        showMessage(
          "success",
          next
            ? "품절 처리했습니다. 손님이 주문할 수 없습니다."
            : "판매를 다시 시작했습니다."
        );
        router.refresh();
      }
    } catch {
      showMessage("error", "연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card padding="sm" className={cn(soldOut && "border-accent-red/60")}>
      <div className="flex flex-col gap-3">
        <Input
          label="옵션 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 나주배 선물세트 5kg"
        />
        <Input
          label="설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 7~9과 · 명절 선물용"
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`price-${option.id}`}
            className="text-sm font-bold text-brand-dark"
          >
            가격 (배송비 포함)
          </label>
          <div className="relative">
            <input
              id={`price-${option.id}`}
              value={priceText}
              onChange={(e) =>
                setPriceText(e.target.value.replace(/[^\d]/g, ""))
              }
              inputMode="numeric"
              placeholder="27000"
              aria-invalid={priceText !== "" && !priceValid ? true : undefined}
              className={cn(
                "w-full rounded-xl border-2 bg-white px-4 py-3 pr-12 text-right text-xl font-bold text-ink placeholder:font-normal placeholder:text-ink/35 focus:outline-none",
                priceText !== "" && !priceValid
                  ? "border-accent-red focus:border-accent-red"
                  : "border-brand/35 focus:border-brand"
              )}
            />
            <span
              aria-hidden="true"
              className="absolute top-1/2 right-4 -translate-y-1/2 text-lg font-bold text-ink/60"
            >
              원
            </span>
          </div>
          {priceValid && (
            <p className="text-base font-bold text-brand-dark">
              {formatWon(price)}
            </p>
          )}
        </div>

        {/* 품절 토글 — 크고 명확하게, 누르면 즉시 저장 */}
        <button
          type="button"
          role="switch"
          aria-checked={soldOut}
          disabled={toggling}
          onClick={handleToggleSoldOut}
          className={cn(
            "flex min-h-14 w-full cursor-pointer items-center justify-between rounded-2xl border-2 px-4 text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            soldOut
              ? "border-accent-red bg-accent-red/10 text-accent-red"
              : "border-brand bg-brand-light text-brand-dark"
          )}
        >
          <span>{soldOut ? "지금 품절 상태입니다" : "지금 판매 중입니다"}</span>
          <span
            className={cn(
              "rounded-xl border-2 px-3 py-1.5 text-base",
              soldOut
                ? "border-accent-red bg-white"
                : "border-brand-dark bg-white"
            )}
          >
            {toggling
              ? "저장 중..."
              : soldOut
                ? "판매 재개하기"
                : "품절 처리하기"}
          </span>
        </button>

        {message && (
          <p
            role="status"
            className={
              message.type === "success"
                ? "text-lg font-bold text-brand-dark"
                : "text-lg font-bold text-accent-red"
            }
          >
            {message.type === "success" ? "✓ " : ""}
            {message.text}
          </p>
        )}

        <Button
          size="lg"
          disabled={saving}
          onClick={handleSave}
          className="w-full text-xl"
        >
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>
    </Card>
  );
}
