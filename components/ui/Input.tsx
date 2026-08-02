"use client";

import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 접근성을 위해 label 필수. 시각적으로 숨기려면 labelHidden 사용 */
  label: string;
  labelHidden?: boolean;
  error?: string;
  hint?: string;
}

export default function Input({
  label,
  labelHidden = false,
  error,
  hint,
  id,
  required,
  className,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          "text-sm font-medium text-ink",
          labelHidden && "sr-only"
        )}
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          "w-full rounded-xl border bg-white px-4 py-3 text-base text-ink transition-colors placeholder:text-muted/60 focus:outline-none",
          error
            ? "border-danger focus:border-danger"
            : "border-hairline focus:border-brand",
          className
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export { Input };
