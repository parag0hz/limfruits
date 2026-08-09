import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import type { OrderItem, OrderStatus } from "@/lib/types";
import { formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPING",
  "DONE",
  "CANCELED",
];

function itemsSummary(items: OrderItem[]): string {
  return items
    .map((it) => `${it.productName} ${it.optionName} x ${it.quantity}`)
    .join(", ");
}

function totalQuantity(items: OrderItem[]): number {
  return items.reduce((sum, it) => sum + it.quantity, 0);
}

function itemsAmount(items: OrderItem[]): number {
  return items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
}

interface ExportRow {
  배송건번호: string;
  주문번호: string;
  보내는분: string;
  받는분성명: string;
  받는분전화번호: string;
  우편번호: string;
  주소: string;
  품목명: string;
  수량: number;
  배송메시지: string;
  금액: number;
}

/**
 * GET /api/admin/orders/export?status=PAID
 * 로젠 iSales 등 택배사 송장 시스템에 대량 등록할 수 있는 주문 엑셀.
 * - 행 단위는 배송 건. 단일 주문은 1행, 선물(다중배송) 주문은 배송 건마다 1행.
 * - 배송건번호: 단일=주문번호, 선물=주문번호#1, 주문번호#2 …
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

  const rows: ExportRow[] = [];
  for (const o of orders) {
    if (o.kind === "GIFT" && o.shipments.length > 0) {
      o.shipments.forEach((s, i) => {
        rows.push({
          배송건번호: `${o.orderNo}#${i + 1}`,
          주문번호: o.orderNo,
          보내는분: o.customerName,
          받는분성명: s.recipientName,
          받는분전화번호: formatPhone(s.phone),
          우편번호: s.postcode,
          주소: [s.address1, s.address2].filter(Boolean).join(" "),
          품목명: itemsSummary(s.items),
          수량: totalQuantity(s.items),
          배송메시지: s.giftMessage,
          금액: itemsAmount(s.items),
        });
      });
    } else {
      rows.push({
        배송건번호: o.orderNo,
        주문번호: o.orderNo,
        보내는분: "",
        받는분성명: o.customerName,
        받는분전화번호: formatPhone(o.phone),
        우편번호: o.postcode,
        주소: [o.address1, o.address2].filter(Boolean).join(" "),
        품목명: itemsSummary(o.items),
        수량: totalQuantity(o.items),
        배송메시지: o.memo,
        금액: o.totalAmount,
      });
    }
  }

  const header: (keyof ExportRow)[] = [
    "배송건번호",
    "주문번호",
    "보내는분",
    "받는분성명",
    "받는분전화번호",
    "우편번호",
    "주소",
    "품목명",
    "수량",
    "배송메시지",
    "금액",
  ];

  const ws = XLSX.utils.json_to_sheet(rows, { header });
  ws["!cols"] = [
    { wch: 22 }, // 배송건번호
    { wch: 20 }, // 주문번호
    { wch: 10 }, // 보내는분
    { wch: 10 }, // 받는분성명
    { wch: 15 }, // 받는분전화번호
    { wch: 8 }, // 우편번호
    { wch: 40 }, // 주소
    { wch: 34 }, // 품목명
    { wch: 6 }, // 수량
    { wch: 24 }, // 배송메시지
    { wch: 10 }, // 금액
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
