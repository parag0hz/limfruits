import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "outline" | "danger";
export type ButtonSize = "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark active:bg-brand-dark",
  outline: "bg-surface text-ink hover:bg-hairline/70 active:bg-hairline",
  danger:
    "border border-danger/30 bg-white text-danger hover:bg-danger/5 active:bg-danger/10",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 py-2 text-base",
  lg: "min-h-13 px-7 py-3 text-lg",
};

const BASE_CLASSES =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Button 과 동일한 시각을 <a>/<Link> 등 다른 요소에 입힐 때 쓰는 클래스 헬퍼.
 * (버튼처럼 보이지만 실제로는 링크 이동이 맞는 CTA — 히어로·선물 진입 등 — 에 사용)
 * Button 컴포넌트의 렌더 결과와 클래스 구성이 동일하다.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
): string {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className);
}

/**
 * BRAND v2 버튼 — rounded-full, 장식 없는 솔리드/서피스.
 * variant: primary(그린 솔리드) / outline(서피스 배경 + ink) / danger(레드)
 * size: md(44px+) / lg(52px+) — 터치 타깃 확보
 */
export default function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}

export { Button };
