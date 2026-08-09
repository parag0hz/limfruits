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
  // xlsx는 압축 포맷이라 5MB 파일도 수십만 행으로 팽창할 수 있다. 행마다 주문을
  // 순차 조회하므로, 서버리스 타임아웃을 막기 위해 처리 행수에 상한을 둔다.
  const MAX_ROWS = 2000;
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `한 번에 처리할 수 있는 행은 ${MAX_ROWS.toLocaleString()}행까지입니다. 파일을 나눠서 올려 주세요.`,
      },
      { status: 400 }
    );
  }

  const keys = Object.keys(rows[0]);
  // 배송건번호(선물 주문의 건별 식별자, "주문번호#2" 형태 포함)를 우선 사용,
  // 없으면 기존 주문번호 열로 폴백
  const shipmentKey = findKey(keys, ["배송건번호", "배송건", "배송번호"]);
  const orderKey = findKey(keys, ["주문번호", "주문no", "orderno", "주문"]);
  const idKey = shipmentKey ?? orderKey;
  const trackingKey = findKey(keys, [
    "운송장번호",
    "송장번호",
    "운송장",
    "송장",
    "tracking",
  ]);
  if (!idKey || !trackingKey) {
    return NextResponse.json(
      {
        error:
          "주문번호(배송건번호) 열과 운송장(송장)번호 열을 찾지 못했습니다. 첫 행에 '배송건번호' 또는 '주문번호', '운송장번호' 제목이 있는지 확인해 주세요.",
      },
      { status: 400 }
    );
  }

  const store = getStore();
  let updated = 0;
  // 실제로 SHIPPING(배송중)으로 전환된 주문 수 — 선물 주문은 모든 배송 건이
  // 채워져야 전환되므로, 등록 건수(updated)와 구분해 정확히 안내한다.
  const shippedOrders = new Set<string>();
  const skipped: { orderNo: string; reason: string }[] = [];

  for (const row of rows) {
    const rawId = String(row[idKey] ?? "").trim();
    const trackingNo = String(row[trackingKey] ?? "").replace(/[^0-9-]/g, "");
    if (!rawId) continue;

    // "주문번호#2" → 주문번호 + 배송 건 순번(1-based). #가 없으면 주문 단위.
    let orderNo = rawId;
    let shipmentIndex: number | null = null;
    const hashIdx = rawId.indexOf("#");
    if (hashIdx >= 0) {
      orderNo = rawId.slice(0, hashIdx).trim();
      const n = Number(rawId.slice(hashIdx + 1).trim());
      if (Number.isInteger(n) && n >= 1) {
        shipmentIndex = n;
      } else {
        skipped.push({ orderNo: rawId, reason: "배송건번호 형식 오류" });
        continue;
      }
    }
    if (!orderNo) continue;
    if (!trackingNo) {
      skipped.push({ orderNo: rawId, reason: "운송장번호 없음" });
      continue;
    }
    const order = await store.getOrderByNo(orderNo);
    if (!order) {
      skipped.push({ orderNo: rawId, reason: "주문을 찾을 수 없음" });
      continue;
    }
    if (order.status === "CANCELED" || order.status === "PENDING") {
      skipped.push({
        orderNo: rawId,
        reason: order.status === "CANCELED" ? "취소된 주문" : "결제 전 주문",
      });
      continue;
    }

    if (shipmentIndex !== null) {
      // 선물 주문의 배송 건 단위 저장
      const shipment = order.shipments[shipmentIndex - 1];
      if (!shipment) {
        skipped.push({ orderNo: rawId, reason: "배송 건을 찾을 수 없음" });
        continue;
      }
      await store.updateShipment(orderNo, shipment.id, {
        courier,
        trackingNo,
      });
      updated += 1;
      // 모든 배송 건에 운송장이 채워지면 주문 전체를 배송중으로 전환
      const fresh = await store.getOrderByNo(orderNo);
      if (
        fresh &&
        fresh.kind === "GIFT" &&
        fresh.status === "PAID" &&
        fresh.shipments.length > 0 &&
        fresh.shipments.every((s) => s.courier && s.trackingNo)
      ) {
        await store.updateOrder(orderNo, { status: "SHIPPING" });
        shippedOrders.add(orderNo);
      }
    } else {
      // 주문 단위 저장 (단일 주문). 선물 주문은 배송건번호(#n)로만 건별 저장되어야
      // 하며, #n 없이 들어오면 상위 운송장만 채워지고 배송 건은 비어 상태가
      // 어긋난다(선물 상세 UI는 shipments만 렌더). 그래서 GIFT는 여기서 막는다.
      if (order.kind === "GIFT") {
        skipped.push({
          orderNo: rawId,
          reason: "선물 주문은 배송건번호(주문번호#번호)로 올려 주세요",
        });
        continue;
      }
      await store.updateOrder(orderNo, {
        status: "SHIPPING",
        courier,
        trackingNo,
      });
      updated += 1;
      shippedOrders.add(orderNo);
    }
  }

  return NextResponse.json({
    ok: true,
    updated,
    shipped: shippedOrders.size,
    skipped,
  });
}
