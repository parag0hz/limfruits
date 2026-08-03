import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import type { Order, OrderStatus } from "@/lib/types";
import { formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPING",
  "DONE",
  "CANCELED",
];

function itemsSummary(order: Order): string {
  return order.items
    .map((it) => `${it.productName} ${it.optionName} x ${it.quantity}`)
    .join(", ");
}

function totalQuantity(order: Order): number {
  return order.items.reduce((sum, it) => sum + it.quantity, 0);
}

/**
 * GET /api/admin/orders/export?status=PAID
 * 로젠 iSales 등 택배사 송장 시스템에 대량 등록할 수 있는 주문 엑셀.
 * 기본은 신규주문(PAID)만 내려받는다.
 */
export async function GET(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const rawStatus = (url.searchParams.get("status") ?? "PAID").toUpperCase();
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as OrderStatus)
    : "PAID";

  const store = getStore();
  const orders = await store.listOrders({ status });

  const rows = orders.map((o) => ({
    주문번호: o.orderNo,
    받는분성명: o.customerName,
    받는분전화번호: formatPhone(o.phone),
    우편번호: o.postcode,
    주소: [o.address1, o.address2].filter(Boolean).join(" "),
    품목명: itemsSummary(o),
    수량: totalQuantity(o),
    배송메시지: o.memo,
    금액: o.totalAmount,
  }));

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "주문번호",
      "받는분성명",
      "받는분전화번호",
      "우편번호",
      "주소",
      "품목명",
      "수량",
      "배송메시지",
      "금액",
    ],
  });
  ws["!cols"] = [
    { wch: 20 },
    { wch: 10 },
    { wch: 15 },
    { wch: 8 },
    { wch: 40 },
    { wch: 34 },
    { wch: 6 },
    { wch: 24 },
    { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "주문");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const today = new Date();
  const ymd = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("");
  const filename = `limfruits-orders-${ymd}.xlsx`;
  const korName = encodeURIComponent(`임과일_송장주문_${ymd}.xlsx`);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${korName}`,
      "Cache-Control": "no-store",
    },
  });
}
