"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/components/ui/cn";
import { isValidBlockImageUrl } from "@/app/api/admin/products/detail-blocks";

/**
 * 상품 기본 정보 편집 폼.
 * - 노출 토글은 누르면 즉시 저장 (품절 토글과 같은 방식)
 * - 이름/한 줄 소개/사진 주소/상세 소개는 '저장' 버튼으로 한 번에 저장
 */
export default function ProductForm({ product }: { product: Product }) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [subtitle, setSubtitle] = useState(product.subtitle);
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [detail, setDetail] = useState(product.detail);
  const [isActive, setIsActive] = useState(product.isActive);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedImageUrl = imageUrl.trim();
  // 상세페이지 블록의 사진 주소와 같은 규칙(https:// 또는 / 시작) — 화면마다
  // 규칙이 다르면 혼란스럽고, http:// 는 https 배포에서 혼합 콘텐츠로 차단된다
  const imageUrlValid =
    trimmedImageUrl === "" || isValidBlockImageUrl(trimmedImageUrl);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (type === "success") {
      timerRef.current = setTimeout(() => setMessage(null), 3000);
    }
  }

  async function patchProduct(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/admin/products/${product.id}`, {
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
      showMessage("error", "상품 이름을 입력해 주세요.");
      return;
    }
    if (!imageUrlValid) {
      showMessage("error", "사진 주소는 https:// 로 시작해야 합니다.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const ok = await patchProduct({
        name: name.trim(),
        subtitle: subtitle.trim(),
        imageUrl: trimmedImageUrl === "" ? null : trimmedImageUrl,
        detail: detail.trim(),
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

  async function handleToggleActive() {
    if (toggling) return;
    const next = !isActive;
    setToggling(true);
    setMessage(null);
    try {
      const ok = await patchProduct({ isActive: next });
      if (ok) {
        setIsActive(next);
        showMessage(
          "success",
          next
            ? "이제 손님에게 이 상품이 보입니다."
            : "숨김 처리했습니다. 손님에게 보이지 않습니다."
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
    <Card padding="sm">
      <div className="flex flex-col gap-4">
        {/* 노출 토글 — 크고 명확하게, 누르면 즉시 저장 */}
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          disabled={toggling}
          onClick={handleToggleActive}
          className={cn(
            "flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 text-left text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            isActive
              ? "border-brand/40 bg-brand/5 text-brand-dark"
              : "border-hairline bg-surface text-muted"
          )}
        >
          <span>
            {isActive ? "지금 손님에게 보입니다" : "지금 숨김 상태입니다"}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full border bg-white px-4 py-1.5 text-base font-semibold",
              isActive ? "border-brand/40 text-brand-dark" : "border-ink/20 text-ink"
            )}
          >
            {toggling ? "저장 중..." : isActive ? "숨기기" : "보이게 하기"}
          </span>
        </button>

        <Input
          label="상품 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 나주배"
          required
          className="text-lg font-bold"
        />

        <Input
          label="한 줄 소개"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="예: 산지에서 바로 보내는 나주배"
          hint="상품 이름 아래에 작게 나오는 문구입니다."
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label="대표 사진 주소 (선택)"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setImageBroken(false);
            }}
            placeholder="https://..."
            inputMode="url"
            error={
              imageUrlValid
                ? undefined
                : "사진 주소는 https:// 로 시작해야 합니다."
            }
            hint="https:// 로 시작하는 사진 주소(인터넷 주소)를 붙여넣으세요. 비워 두면 기본 그림이 나옵니다."
          />
          {trimmedImageUrl !== "" && imageUrlValid && (
            <div className="mt-1 overflow-hidden rounded-xl border border-hairline bg-surface">
              {imageBroken ? (
                <p className="px-4 py-6 text-center text-base font-bold text-danger">
                  이 주소로는 사진을 불러올 수 없습니다. 주소를 다시 확인해
                  주세요.
                </p>
              ) : (
                // 임의 주소의 외부 이미지라 next/image 대신 일반 img로 미리보기
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={trimmedImageUrl}
                  alt="대표 사진 미리보기"
                  onError={() => setImageBroken(true)}
                  className="max-h-64 w-full object-cover"
                />
              )}
            </div>
          )}
        </div>

        <Textarea
          label="상세 소개 (예비 본문)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={10}
          placeholder={
            "상품을 소개하는 글을 적어 주세요.\n\n빈 줄(엔터 두 번)로 나누면 문단이 바뀝니다."
          }
          hint={
            product.blocks.length > 0
              ? "지금은 아래 '상세페이지 구성' 블록이 손님에게 보입니다. 이 글은 블록을 모두 지웠을 때만 보이는 예비 본문입니다."
              : "문단을 나누려면 빈 줄(엔터 두 번)로 구분해 주세요. 아래 '상세페이지 구성'에 블록을 추가하면 이 글 대신 블록이 보입니다."
          }
        />

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
