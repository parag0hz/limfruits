import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import type { Promo } from "@/lib/types";

/**
 * PATCH /api/admin/promo — 입장 팝업(명절 발송 캘린더) 설정 저장 (SPEC v2.6 부록)
 *
 * requireAdmin 필수. body 는 Promo 의 부분 집합. 제공된 필드만 검증 후 updatePromo.
 * 검증(부록 그대로):
 *  - enabled: boolean
 *  - title / ctaLabel: 문자열, 80자 이하
 *  - body: 문자열, 1000자 이하
 *  - 날짜(shipStart/shipEnd/reserveDeadline): 빈 문자열/null 또는 유효한 YYYY-MM-DD
 *  - ctaHref: '/' 로 시작하는 내부 경로만 (javascript:·//외부·역슬래시·공백 거부)
 *  - shipEnd >= shipStart (둘 다 값이 있을 때)
 */

const MAX_TITLE = 80;
const MAX_LABEL = 80;
const MAX_BODY = 1000;
const MAX_HREF = 200;

/** 형식뿐 아니라 실제 달력상 유효한 날짜인지 확인 (예: 2026-02-30 거부). UTC 기준 분해. */
function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("요청 형식이 올바르지 않습니다.");
  }
  if (body === null || typeof body !== "object") {
    return bad("요청 형식이 올바르지 않습니다.");
  }

  const patch: Partial<Promo> = {};

  // 노출 on/off
  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") {
      return bad("노출 여부 값이 올바르지 않습니다.");
    }
    patch.enabled = body.enabled;
  }

  // 제목
  if ("title" in body) {
    if (typeof body.title !== "string") {
      return bad("제목 값이 올바르지 않습니다.");
    }
    const t = body.title.trim();
    if (t.length > MAX_TITLE) {
      return bad(`제목은 ${MAX_TITLE}자 이하로 입력해 주세요.`);
    }
    patch.title = t;
  }

  // 버튼 문구
  if ("ctaLabel" in body) {
    if (typeof body.ctaLabel !== "string") {
      return bad("버튼 문구 값이 올바르지 않습니다.");
    }
    const t = body.ctaLabel.trim();
    if (t.length > MAX_LABEL) {
      return bad(`버튼 문구는 ${MAX_LABEL}자 이하로 입력해 주세요.`);
    }
    patch.ctaLabel = t;
  }

  // 안내 문구 (여러 줄 유지, 앞뒤 공백만 제거)
  if ("body" in body) {
    if (typeof body.body !== "string") {
      return bad("안내 문구 값이 올바르지 않습니다.");
    }
    const t = body.body.trim();
    if (t.length > MAX_BODY) {
      return bad(`안내 문구는 ${MAX_BODY}자 이하로 입력해 주세요.`);
    }
    patch.body = t;
  }

  // 날짜 3종 — 빈 값/null 이면 null 로 저장, 값이 있으면 YYYY-MM-DD 유효성 검사
  const dateFields: Array<keyof Pick<
    Promo,
    "shipStart" | "shipEnd" | "reserveDeadline"
  >> = ["shipStart", "shipEnd", "reserveDeadline"];
  const dateLabels: Record<string, string> = {
    shipStart: "발송 시작일",
    shipEnd: "발송 마감일",
    reserveDeadline: "예약 마감일",
  };
  for (const key of dateFields) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null || raw === "") {
      patch[key] = null;
      continue;
    }
    if (typeof raw !== "string") {
      return bad(`${dateLabels[key]} 값이 올바르지 않습니다.`);
    }
    const t = raw.trim();
    if (t === "") {
      patch[key] = null;
      continue;
    }
    if (!isValidDateString(t)) {
      return bad(`${dateLabels[key]}가 올바른 날짜(YYYY-MM-DD)가 아닙니다.`);
    }
    patch[key] = t;
  }

  // CTA 링크 — 내부 경로만 (외부/스킴 이동 차단)
  if ("ctaHref" in body) {
    if (typeof body.ctaHref !== "string") {
      return bad("링크 값이 올바르지 않습니다.");
    }
    const h = body.ctaHref.trim();
    if (
      !h.startsWith("/") ||
      h.startsWith("//") ||
      h.includes("\\") ||
      /\s/.test(h) ||
      h.length > MAX_HREF
    ) {
      return bad("링크는 / 로 시작하는 내부 주소여야 합니다.");
    }
    patch.ctaHref = h;
  }

  if (Object.keys(patch).length === 0) {
    return bad("변경할 내용이 없습니다.");
  }

  const store = getStore();

  // shipEnd >= shipStart 는 현재 저장값과 병합한 최종 상태 기준으로 검사 (부분 수정 대비)
  const current = await store.getPromo();
  const effective: Promo = { ...current, ...patch };
  if (
    effective.shipStart &&
    effective.shipEnd &&
    effective.shipEnd < effective.shipStart
  ) {
    return bad("발송 마감일은 시작일과 같거나 이후여야 합니다.");
  }

  await store.updatePromo(patch);
  const promo = await store.getPromo();
  return NextResponse.json({ ok: true, promo });
}
