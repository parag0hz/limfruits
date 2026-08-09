import type { Order, OrderItem } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

/** KST 기준 "YYYY-MM-DD" */
function kstDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** KST 기준 "HH:MM" */
function kstTime(d: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * 주문 시각 표시 (한국 시간 기준)
 * - 오늘이면 "오늘 14:30"
 * - 올해면 "7월 28일 14:30"
 * - 그 외 "2025.12.31 14:30"
 */
export function formatOrderTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const dayKey = kstDateKey(d);
  if (dayKey === kstDateKey(now)) {
    return `오늘 ${kstTime(d)}`;
  }

  const [year, month, day] = dayKey.split("-");
  if (year === kstDateKey(now).slice(0, 4)) {
    return `${Number(month)}월 ${Number(day)}일 ${kstTime(d)}`;
  }
  return formatDateTime(iso);
}

/** "나주배" + "가정용 3kg" → "나주배 가정용 3kg" (스냅샷에 상품명이 없으면 옵션명만) */
export function itemLabel(item: OrderItem): string {
  return [item.productName, item.optionName].filter(Boolean).join(" ");
}

/** 주문 항목 요약: "나주배 가정용 3kg × 2", 여러 개면 " 외 N건" */
export function summarizeItems(items: OrderItem[]): string {
  if (items.length === 0) return "-";
  const first = items[0];
  const head = `${itemLabel(first)} × ${first.quantity}`;
  if (items.length === 1) return head;
  return `${head} 외 ${items.length - 1}건`;
}

/** 선물 주문 받는 분 요약: "홍길동", 여러 명이면 "홍길동 외 N명" */
export function summarizeRecipients(order: Order): string {
  const ships = order.shipments;
  if (ships.length === 0) return "-";
  const first = ships[0].recipientName || "받는 분";
  if (ships.length === 1) return first;
  return `${first} 외 ${ships.length - 1}명`;
}
