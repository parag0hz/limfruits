import type { HTMLAttributes } from "react";
import type { OrderStatus } from "@/lib/types";
import { cn } from "./cn";

export type BadgeTone =
  | "green" // 연그린 배경 (일반 강조)
  | "greenSolid" // 그린 채움 (신규주문 등 강한 강조)
  | "yellow" // 대기/주의
  | "red" // 품절/취소
  | "gray"; // 완료/비활성

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: "border-brand bg-brand-light text-brand-dark",
  greenSolid: "border-brand-dark bg-brand text-white",
  yellow: "border-accent-yellow bg-accent-yellow/25 text-ink",
  red: "border-accent-red bg-accent-red/10 text-accent-red",
  gray: "border-ink/25 bg-ink/5 text-ink/60",
};

export default function Badge({
  tone = "green",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-sm font-bold whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}

/** 주문 상태 한국어 라벨 */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  SHIPPING: "배송중",
  DONE: "배송완료",
  CANCELED: "취소",
};

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING: "yellow",
  PAID: "greenSolid", // 신규 주문 강조
  SHIPPING: "green",
  DONE: "gray",
  CANCELED: "red",
};

/** 주문 상태 뱃지 — 상태별 색/라벨 자동 매핑 */
export function StatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

export { Badge };
