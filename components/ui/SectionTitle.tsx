import type { ReactNode } from "react";
import { cn } from "./cn";

export interface SectionTitleProps {
  children: ReactNode;
  /** 제목 아래 보조 설명 */
  sub?: ReactNode;
  /** 제목 태그 레벨 (기본 h2) */
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  className?: string;
}

/** 섹션 제목 — Jua 손글씨 서체 + 진한 그린 */
export default function SectionTitle({
  children,
  sub,
  as: Tag = "h2",
  align = "left",
  className,
}: SectionTitleProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      <Tag className="font-heading text-2xl text-brand-dark sm:text-3xl">
        {children}
      </Tag>
      {sub && <p className="mt-1.5 text-base text-ink/70">{sub}</p>}
    </div>
  );
}

export { SectionTitle };
