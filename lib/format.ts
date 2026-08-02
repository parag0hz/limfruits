/** 27000 → "27,000원" */
export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

/** 전화번호에서 숫자만 남김: "010-1234-5678" → "01012345678" */
export function normalizePhone(s: string): string {
  return s.replace(/\D/g, '');
}

/** "01012345678" → "010-1234-5678" (형식이 안 맞으면 원본 숫자 반환) */
export function formatPhone(s: string): string {
  const digits = normalizePhone(s);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    if (digits.startsWith('02')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

/** ISO 문자열 → "2026.08.02 14:30" (한국 시간 기준) */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}
