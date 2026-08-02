/** 클래스명을 조건부로 이어 붙이는 헬퍼 (외부 라이브러리 없이) */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
