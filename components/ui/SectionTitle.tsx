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

/** 섹션 제목 — Pretendard 볼드 + tracking-tight, 보조 설명은 muted */
export default function SectionTitle({
  children,
  sub,
  as: Tag = "h2",
  align = "left",
  className,
}: SectionTitleProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      <Tag className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {children}
      </Tag>
      {sub && <p className="mt-2 text-base text-muted">{sub}</p>}
    </div>
  );
}

export { SectionTitle };
