"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Promo } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";

/**
 * 입장 팝업 설정 폼 (SPEC v2.6 부록).
 * 부모님(장년층·휴대폰) 기준 큰 글씨·큰 버튼. 노출 토글도 폼의 일부라
 * 날짜/문구와 함께 한 번의 '저장'으로 반영된다 (잘못된 날짜로 켜지는 사고 방지).
 */

// CTA 링크 후보 — 직접 경로를 타이핑하다 오타가 나지 않도록 목록에서 고른다.
const CTA_PRESETS: { href: string; label: string }[] = [
  { href: "/order/gift", label: "선물·대량 주문 페이지" },
  { href: "/", label: "홈 (상품 목록)" },
  { href: "/order/lookup", label: "주문·배송 조회" },
];

/** 'YYYY-MM-DD' → 'M월 D일' (미리보기용). 형식이 아니면 원문 반환. */
function toKoreanDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${Number(m[2])}월 ${Number(m[3])}일`;
}

export default function PromoForm({ promo }: { promo: Promo }) {
  const router = useRouter();

  const [enabled, setEnabled] = useState(promo.enabled);
  const [title, setTitle] = useState(promo.title);
  const [body, setBody] = useState(promo.body);
  const [shipStart, setShipStart] = useState(promo.shipStart ?? "");
  const [shipEnd, setShipEnd] = useState(promo.shipEnd ?? "");
  const [reserveDeadline, setReserveDeadline] = useState(
    promo.reserveDeadline ?? ""
  );
  const [ctaLabel, setCtaLabel] = useState(promo.ctaLabel);
  const [ctaHref, setCtaHref] = useState(promo.ctaHref);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 현재 CTA 값이 후보에 없으면(관리 API 등으로 다른 경로가 저장된 경우) 목록에 함께 노출
  const ctaOptions = CTA_PRESETS.some((o) => o.href === ctaHref)
    ? CTA_PRESETS
    : [{ href: ctaHref, label: ctaHref }, ...CTA_PRESETS];

  const dateOrderInvalid =
    shipStart !== "" && shipEnd !== "" && shipEnd < shipStart;

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (type === "success") {
      timerRef.current = setTimeout(() => setMessage(null), 3500);
    }
  }

  async function handleSave() {
    if (saving) return;

    if (title.trim() === "") {
      showMessage("error", "팝업 제목을 입력해 주세요.");
      return;
    }
    if (ctaLabel.trim() === "") {
      showMessage("error", "버튼에 들어갈 문구를 입력해 주세요.");
      return;
    }
    if (dateOrderInvalid) {
      showMessage("error", "발송 마감일은 시작일과 같거나 이후여야 합니다.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          title: title.trim(),
          body: body.trim(),
          shipStart: shipStart === "" ? null : shipStart,
          shipEnd: shipEnd === "" ? null : shipEnd,
          reserveDeadline: reserveDeadline === "" ? null : reserveDeadline,
          ctaLabel: ctaLabel.trim(),
          ctaHref,
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
        showMessage(
          "error",
          data?.error ?? "저장에 실패했습니다. 다시 시도해 주세요."
        );
        return;
      }
      showMessage(
        "success",
        enabled
          ? "저장되었습니다. 지금 손님에게 팝업이 보입니다."
          : "저장되었습니다. 팝업은 지금 꺼져 있어 손님에게 보이지 않습니다."
      );
      router.refresh();
    } catch {
      showMessage(
        "error",
        "연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSaving(false);
    }
  }

  // 미리보기용 발송 기간 문구
  let shipLine = "";
  if (shipStart && shipEnd) {
    shipLine = `발송 ${toKoreanDate(shipStart)} ~ ${toKoreanDate(shipEnd)}`;
  } else if (shipStart) {
    shipLine = `발송 ${toKoreanDate(shipStart)}부터`;
  } else if (shipEnd) {
    shipLine = `발송 ${toKoreanDate(shipEnd)}까지`;
  }

  return (
    <div className="flex flex-col gap-5">
      <Card padding="sm">
        <div className="flex flex-col gap-5">
          {/* 노출 토글 — 크게. 저장을 눌러야 실제 반영됨 */}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={cn(
              "flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 text-left text-lg font-bold transition-colors",
              enabled
                ? "border-brand/40 bg-brand/5 text-brand-dark"
                : "border-hairline bg-surface text-muted"
            )}
          >
            <span>
              {enabled ? "팝업을 켠 상태입니다" : "팝업을 끈 상태입니다"}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full border bg-white px-4 py-1.5 text-base font-semibold",
                enabled
                  ? "border-brand/40 text-brand-dark"
                  : "border-ink/20 text-ink"
              )}
            >
              {enabled ? "끄기" : "켜기"}
            </span>
          </button>
          <p className="-mt-3 text-sm text-muted">
            켜고 끈 것은 아래 &lsquo;저장&rsquo;을 눌러야 실제로 손님 화면에
            반영됩니다.
          </p>

          <Input
            label="팝업 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 추석 선물세트 예약 안내"
            maxLength={80}
            required
            className="text-lg font-bold"
          />

          <Textarea
            label="안내 문구"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={1000}
            placeholder={
              "손님에게 보여 줄 안내 글입니다.\n\n빈 줄(엔터 두 번)로 나누면 문단이 바뀝니다."
            }
            hint="문단을 나누려면 빈 줄(엔터 두 번)로 구분해 주세요."
            className="text-lg"
          />

          {/* 발송 캘린더에 쓰이는 날짜 3종 */}
          <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface/60 p-4">
            <p className="text-base font-bold text-ink">발송 기간</p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Input
                  label="발송 시작일"
                  type="date"
                  value={shipStart}
                  onChange={(e) => setShipStart(e.target.value)}
                  className="text-lg"
                />
              </div>
              <div className="flex-1">
                <Input
                  label="발송 마감일"
                  type="date"
                  value={shipEnd}
                  min={shipStart || undefined}
                  onChange={(e) => setShipEnd(e.target.value)}
                  error={
                    dateOrderInvalid
                      ? "시작일보다 앞설 수 없습니다."
                      : undefined
                  }
                  className="text-lg"
                />
              </div>
            </div>
            <Input
              label="예약 마감일 (선택)"
              type="date"
              value={reserveDeadline}
              onChange={(e) => setReserveDeadline(e.target.value)}
              hint="예약을 받는 마지막 날. 비워 두면 표시하지 않습니다."
              className="text-lg"
            />
            <p className="text-sm text-muted">
              날짜를 모두 비워 두면 달력 없이 안내 문구만 보입니다.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Input
                label="버튼 문구"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="예: 선물 주문하기"
                maxLength={80}
                required
                className="text-lg"
              />
            </div>
            <div className="flex-1">
              <Select
                label="버튼을 누르면 갈 곳"
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
                className="text-lg"
              >
                {ctaOptions.map((o) => (
                  <option key={o.href} value={o.href}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {message && (
            <p
              role="status"
              className={
                message.type === "success"
                  ? "text-lg font-bold text-brand-dark"
                  : "text-lg font-bold text-danger"
              }
            >
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

      {/* 미리보기 — 손님에게 보일 팝업의 대략적인 모습 */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">미리보기</h2>
        <p className="mt-1 text-base text-muted">
          손님에게 보일 팝업의 대략적인 모습입니다. 실제 화면의 달력은 위
          날짜대로 그려집니다.
        </p>

        <div className="mt-3 rounded-2xl border border-hairline bg-surface p-5">
          <div className="mx-auto w-full max-w-sm rounded-2xl border border-hairline bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold tracking-tight text-ink">
              {title.trim() === "" ? "(제목을 입력해 주세요)" : title}
            </h3>

            {shipLine && (
              <p className="mt-3 inline-flex rounded-full bg-brand px-3 py-1 text-sm font-bold text-white">
                {shipLine}
              </p>
            )}

            {body.trim() !== "" && (
              <div className="mt-3 flex flex-col gap-2">
                {body
                  .trim()
                  .split(/\n{2,}/)
                  .map((para, i) => (
                    <p
                      key={i}
                      className="whitespace-pre-line text-base leading-relaxed text-muted"
                    >
                      {para}
                    </p>
                  ))}
              </div>
            )}

            {reserveDeadline !== "" && (
              <p className="mt-3 text-base font-semibold text-ink">
                예약 마감 {toKoreanDate(reserveDeadline)}
              </p>
            )}

            <div className="mt-5">
              <span className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brand px-6 text-lg font-semibold text-white">
                {ctaLabel.trim() === "" ? "(버튼 문구)" : ctaLabel}
              </span>
            </div>

            <p className="mt-4 text-center text-sm text-muted">
              오늘 하루 보지 않기 · 닫기
            </p>
          </div>

          <p className="mt-4 text-center text-base font-semibold text-muted">
            {enabled
              ? "지금 설정: 켜짐 (저장하면 손님에게 보입니다)"
              : "지금 설정: 꺼짐 (손님에게 보이지 않습니다)"}
          </p>
        </div>
      </div>
    </div>
  );
}
