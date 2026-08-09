/**
 * 리뷰 작성자 이름 마스킹 — 화면에는 항상 마스킹된 이름만 표시한다.
 * "김수" → "김*", "김철수" → "김*수", "남궁민수" → "남**수"
 */
export function maskName(name: string): string {
  const chars = Array.from(name.trim());
  if (chars.length <= 1) return chars.join('');
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}
