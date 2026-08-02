"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductOption } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import PriceField, { parsePriceText } from "./PriceField";

/**
 * 옵션 한 개 인라인 편집 카드.
 * - 이름/설명/가격은 '저장' 버튼으로 저장
 * - 품절 토글은 누르면 즉시 저장
 * - 삭제는 confirm 후 진행 (기존 주문 내역은 스냅샷이라 영향 없음)
 */
export default function OptionEditor({ option }: { option: ProductOption }) {
  const router = useRouter();
  const [name, setName] = useState(option.name);
  const [description, setDescription] = useState(option.description);
  const [priceText, setPriceText] = useState(String(option.price));
  const [soldOut, setSoldOut] = useState(option.soldOut);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { price, valid: priceValid } = parsePriceText(priceText);
  const busy = saving || toggling || deleting;

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (type === "success") {
      timerRef.current = setTimeout(() => setMessage(null), 3000);
    }
  }

  async function patchOption(body: Record<string, unknown>): Promise<boolean> {
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
    if (busy) return;
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
    if (busy) return;
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

  async function handleDelete() {
    if (busy) return;
    const confirmed = window.confirm(
      `'${option.name}' 옵션을 삭제할까요?\n기존 주문 내역은 사라지지 않습니다.`
    );
    if (!confirmed) return;
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/options/${option.id}`, {
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
        showMessage(
          "error",
          data?.error ?? "삭제에 실패했습니다. 다시 시도해 주세요."
        );
        return;
      }
      router.refresh();
    } catch {
      showMessage("error", "연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card padding="sm" className={cn(soldOut && "border-danger/50")}>
      <div className="flex flex-col gap-3">
        <Input
          label="옵션 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 가정용 3kg"
        />
        <Input
          label="설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 5~7과 · 실속 가정용"
        />
        <PriceField
          id={`price-${option.id}`}
          value={priceText}
          onChange={setPriceText}
        />

        {/* 품절 토글 — 크고 명확하게, 누르면 즉시 저장 */}
        <button
          type="button"
          role="switch"
          aria-checked={soldOut}
          disabled={busy}
          onClick={handleToggleSoldOut}
          className={cn(
            "flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 text-left text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            soldOut
              ? "border-danger/50 bg-danger/5 text-danger"
              : "border-brand/40 bg-brand/5 text-brand-dark"
          )}
        >
          <span>{soldOut ? "지금 품절 상태입니다" : "지금 판매 중입니다"}</span>
          <span
            className={cn(
              "shrink-0 rounded-full border bg-white px-4 py-1.5 text-base font-semibold",
              soldOut ? "border-danger/50" : "border-brand/40"
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
                : "text-lg font-bold text-danger"
            }
          >
            {message.type === "success" ? "✓ " : ""}
            {message.text}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            size="lg"
            disabled={busy}
            onClick={handleSave}
            className="flex-1 text-xl"
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
          <Button
            variant="danger"
            size="lg"
            disabled={busy}
            onClick={handleDelete}
            className="px-5 text-lg"
          >
            {deleting ? "삭제 중..." : "삭제"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
