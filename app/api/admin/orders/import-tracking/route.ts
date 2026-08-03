import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 헤더 이름이 조금씩 달라도 찾을 수 있게 후보 키워드로 매칭 */
function findKey(keys: string[], candidates: string[]): string | null {
  const normalized = keys.map((k) => ({ raw: k, n: k.replace(/\s+/g, "") }));
  for (const cand of candidates) {
    const hit = normalized.find((k) => k.n.includes(cand));
    if (hit) return hit.raw;
  }
  return null;
}

/**
 * POST /api/admin/orders/import-tracking
 * FormData(file): 주문번호 + 운송장(송장)번호 열이 있는 엑셀/CSV.
 * 로젠 iSales에서 송장 출력 후 내려받은 파일을 그대로 올리면
 * 해당 주문들을 운송장 저장 + 배송중(SHIPPING) 처리한다.
 */
export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let file: File | null = null;
  let courier = "로젠택배";
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
    const c = form.get("courier");
    if (typeof c === "string" && c.trim()) courier = c.trim();
  } catch {
    return NextResponse.json(
      { error: "파일 업로드 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  if (!file) {
    return NextResponse.json(
      { error: "엑셀 파일을 선택해 주세요." },
      { status: 400 }
    );
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "파일이 너무 큽니다. (최대 5MB)" },
      { status: 400 }
    );
  }

  let rows: Record<string, unknown>[];
  try {
    const buf = await file.arrayBuffer();
    let wb: XLSX.WorkBook;
    if (/\.csv$/i.test(file.name)) {
      // 한글 CSV는 UTF-8(BOM 유무)일 수도, 한국 엑셀 기본 저장인 EUC-KR일 수도 있다
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        text = new TextDecoder("euc-kr").decode(buf);
      }
      wb = XLSX.read(text.replace(/^﻿/, ""), { type: "string" });
    } else {
      wb = XLSX.read(buf, { type: "array" });
    }
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
    });
  } catch {
    return NextResponse.json(
      { error: "엑셀 파일을 읽지 못했습니다. xlsx 또는 csv 파일인지 확인해 주세요." },
      { status: 400 }
    );
  }
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "파일에 데이터 행이 없습니다." },
      { status: 400 }
    );
  }

  const keys = Object.keys(rows[0]);
  const orderKey = findKey(keys, ["주문번호", "주문no", "orderno", "주문"]);
  const trackingKey = findKey(keys, [
    "운송장번호",
    "송장번호",
    "운송장",
    "송장",
    "tracking",
  ]);
  if (!orderKey || !trackingKey) {
    return NextResponse.json(
      {
        error:
          "주문번호 열과 운송장(송장)번호 열을 찾지 못했습니다. 첫 행에 '주문번호', '운송장번호' 제목이 있는지 확인해 주세요.",
      },
      { status: 400 }
    );
  }

  const store = getStore();
  let updated = 0;
  const skipped: { orderNo: string; reason: string }[] = [];

  for (const row of rows) {
    const orderNo = String(row[orderKey] ?? "").trim();
    const trackingNo = String(row[trackingKey] ?? "").replace(/[^0-9-]/g, "");
    if (!orderNo) continue;
    if (!trackingNo) {
      skipped.push({ orderNo, reason: "운송장번호 없음" });
      continue;
    }
    const order = await store.getOrderByNo(orderNo);
    if (!order) {
      skipped.push({ orderNo, reason: "주문을 찾을 수 없음" });
      continue;
    }
    if (order.status === "CANCELED" || order.status === "PENDING") {
      skipped.push({
        orderNo,
        reason: order.status === "CANCELED" ? "취소된 주문" : "결제 전 주문",
      });
      continue;
    }
    await store.updateOrder(orderNo, {
      status: "SHIPPING",
      courier,
      trackingNo,
    });
    updated += 1;
  }

  return NextResponse.json({ ok: true, updated, skipped });
}
