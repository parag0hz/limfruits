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
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  );
}

export { Button };
