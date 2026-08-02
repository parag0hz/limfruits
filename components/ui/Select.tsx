"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  labelHidden?: boolean;
  error?: string;
  hint?: string;
}

export default function Select({
  label,
  labelHidden = false,
  error,
  hint,
  id,
  required,
  className,
  children,
  ...props
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className={cn(
          "text-sm font-bold text-brand-dark",
          labelHidden && "sr-only"
        )}
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-accent-red">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <select
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            "w-full cursor-pointer appearance-none rounded-xl border-2 bg-white px-4 py-3 pr-10 text-base text-ink focus:outline-none",
            error
              ? "border-accent-red focus:border-accent-red"
              : "border-brand/35 focus:border-brand",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-brand-dark"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6l5 5 5-5" />
        </svg>
      </div>
      {hint && !error && (
        <p id={hintId} className="text-sm text-ink/60">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-accent-red">
          {error}
        </p>
      )}
    </div>
  );
}

export { Select };
