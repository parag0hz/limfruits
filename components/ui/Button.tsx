import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "outline" | "danger";
export type ButtonSize = "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "border-brand-dark bg-brand text-white hover:bg-brand-dark active:bg-brand-dark",
  outline:
    "border-brand bg-white text-brand-dark hover:bg-brand-light active:bg-brand-light",
  danger:
    "border-accent-red bg-white text-accent-red hover:bg-accent-red hover:text-white active:bg-accent-red active:text-white",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 py-2 text-base",
  lg: "min-h-13 px-6 py-3 text-lg",
};

/**
 * 손그림 감성 버튼: rounded-2xl + 2px 실선 테두리.
 * variant: primary(그린 채움) / outline(흰 바탕 그린 테두리) / danger(레드)
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
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  );
}

export { Button };
