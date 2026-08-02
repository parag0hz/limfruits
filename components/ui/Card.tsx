import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** white: 화이트 + 헤어라인 / light: 서피스 배경 (보더 없음) */
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

/** BRAND v2 카드 — rounded-2xl, 1px 헤어라인 또는 서피스 배경. 두꺼운 테두리 금지 */
export default function Card({
  tone = "white",
  padding = "md",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        PADDING_CLASSES[padding],
        tone === "white" ? "border border-hairline bg-white" : "bg-surface",
        className
      )}
      {...props}
    />
  );
}

export { Card };
