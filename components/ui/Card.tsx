import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 연한 그린 배경 카드 */
  tone?: "white" | "light";
  /**
   * 내부 패딩. cn()이 단순 문자열 결합이라 className으로 `p-0` 등을 넘겨도
   * 기본 p-5/sm:p-6을 덮어쓰지 못하므로(Tailwind 산출 CSS 순서상 큰 값이 이김)
   * 패딩 변형은 반드시 이 prop으로 지정한다.
   * - "md": 기본 (p-5 sm:p-6)
   * - "sm": 컴팩트 (p-4 sm:p-5) — 관리자 화면용
   * - "none": 패딩 없음 — 내부를 플러시하게 채우는 위젯 등
   */
  padding?: "md" | "sm" | "none";
}

const PADDING_CLASSES: Record<NonNullable<CardProps["padding"]>, string> = {
  md: "p-5 sm:p-6",
  sm: "p-4 sm:p-5",
  none: "",
};

/** 손그림 스티커 느낌 카드: 둥근 모서리 + 2px 그린 테두리, 그림자 최소화 */
export default function Card({
  tone = "white",
  padding = "md",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border-2 border-brand",
        PADDING_CLASSES[padding],
        tone === "white" ? "bg-white" : "bg-brand-light",
        className
      )}
      {...props}
    />
  );
}

export { Card };
