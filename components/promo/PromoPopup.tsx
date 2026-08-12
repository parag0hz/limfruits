"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import type { Promo } from "@/lib/types";
import { buttonClasses } from "@/components/ui/Button";
import PromoCalendar from "./PromoCalendar";

/**
 * 입장 팝업 — SPEC v2.6 부록.
 * localStorage 'limfruits_promo_hidden_until'(YYYY-MM-DD)가 오늘 이상이면 표시하지 않는다.
 * SSR/hydration 안전: 초기 open=false, 마운트 후 useEffect 에서 판단해 연다.
 * 모달(오버레이 + 중앙 카드, 모바일 폭 대응), aria-modal, 포커스 트랩, Esc·오버레이 클릭=세션 닫기, 스크롤 락.
 */

const HIDE_KEY = "limfruits_promo_hidden_until";

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 로컬 기준 오늘 'YYYY-MM-DD' — "오늘 하루" 판단의 기준 */
function todayString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 'YYYY-MM-DD' → "M월 D일" (split 파싱 — 타임존 무관) */
function formatMonthDay(value: string): string {
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!m || !d) return value;
  return `${m}월 ${d}일`;
}

export default function PromoPopup({ promo }: { promo: Promo }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // 마운트 후에만 노출 판단 (localStorage 는 클라이언트에서만 접근)
  useEffect(() => {
    // 결제 확정 계열 경로(결제 완료·실패·주문완료)에서는 팝업을 띄우지 않는다.
    // 토스 결제 후 외부 도메인에서 하드 내비게이션으로 진입하므로, 결제 결과 화면을
    // 명절 안내 팝업이 덮어 "결제가 안 끝났나?" 오해를 주는 것을 막는다.
    if (/^\/order\/(?:success|fail|complete)(?:\/|$)/.test(window.location.pathname)) {
      return;
    }
    let hidden = false;
    try {
      const stored = localStorage.getItem(HIDE_KEY);
      hidden = !!stored && stored >= todayString();
    } catch {
      hidden = false;
    }
    if (!hidden) setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const hideToday = useCallback(() => {
    try {
      localStorage.setItem(HIDE_KEY, todayString());
    } catch {
      // 저장 실패는 무시 (시크릿 모드 등)
    }
    setOpen(false);
  }, []);

  // 스크롤 락 + 첫 포커스 이동 / 닫힐 때 포커스 복귀
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const card = cardRef.current;
    const first = card?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? card)?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Esc = 세션 닫기, Tab = 포커스 트랩
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const nodes = Array.from(
        card.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (nodes.length === 0) return;
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === firstEl || !card.contains(active)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (active === lastEl || !card.contains(active)) {
        e.preventDefault();
        firstEl.focus();
      }
    },
    [close]
  );

  const onOverlayMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      // 오버레이 자체를 눌렀을 때만 닫는다(카드 내부 드래그로 닫히지 않게).
      if (e.target === e.currentTarget) close();
    },
    [close]
  );

  if (!open) return null;

  const paragraphs = promo.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const showCalendar = Boolean(promo.shipStart);
  // 렌더 가드를 서버 PATCH /api/admin/promo 의 규칙과 일치시킨다: 내부 경로('/')만 허용하되
  // 프로토콜-상대(//evil.com)·역슬래시는 배제(서비스 롤 직접 DB 조작 대비 심층 방어).
  const safeHref =
    promo.ctaHref.startsWith("/") &&
    !promo.ctaHref.startsWith("//") &&
    !promo.ctaHref.includes("\\");
  const showCta = safeHref && promo.ctaLabel.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-ink/50 px-4 py-6 backdrop-blur-[2px] sm:items-center"
      onMouseDown={onOverlayMouseDown}
      onKeyDown={onKeyDown}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl border border-hairline bg-white shadow-xl outline-none"
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={close}
          className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pb-6 pt-8 sm:px-8">
          <h2
            id={titleId}
            className="text-center text-2xl font-bold tracking-tight text-ink"
          >
            {promo.title}
          </h2>

          {showCalendar && (
            <div className="mt-5">
              <PromoCalendar
                shipStart={promo.shipStart as string}
                shipEnd={promo.shipEnd}
                reserveDeadline={promo.reserveDeadline}
              />
            </div>
          )}

          {paragraphs.length > 0 && (
            <div className="mt-5 space-y-2 text-center text-sm leading-relaxed text-muted">
              {paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          )}

          {promo.reserveDeadline && (
            <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-center text-sm font-semibold text-ink">
              예약 마감 {formatMonthDay(promo.reserveDeadline)}
            </p>
          )}

          {showCta && (
            <Link
              href={promo.ctaHref}
              onClick={close}
              className={buttonClasses("primary", "lg", "mt-6 w-full")}
            >
              {promo.ctaLabel}
            </Link>
          )}
        </div>

        <div className="flex items-stretch border-t border-hairline text-sm">
          <button
            type="button"
            onClick={hideToday}
            className="flex-1 cursor-pointer py-3.5 text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
          >
            오늘 하루 보지 않기
          </button>
          <span className="w-px bg-hairline" aria-hidden="true" />
          <button
            type="button"
            onClick={close}
            className="flex-1 cursor-pointer py-3.5 font-medium text-ink transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
