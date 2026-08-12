import { cn } from "@/components/ui/cn";

/**
 * 입장 팝업 발송 캘린더 — SPEC v2.6 부록.
 * shipStart~shipEnd 가 걸친 달을 그리드로 렌더(1~2개월). 2개월 초과 span 은
 * 2개월까지만 그리고 "이후 순차 발송" 을 덧붙인다.
 * 발송 기간 날짜는 bg-brand text-white 로 강조, 예약 마감일은 링으로 구분.
 *
 * 날짜 파싱은 'YYYY-MM-DD' 를 split 으로 분해한다(Date 파싱의 로컬 타임존 이슈 회피).
 * 요일/일수는 UTC 기준으로 계산해 날짜가 하루 밀리지 않게 한다.
 */

interface PromoCalendarProps {
  shipStart: string; // 'YYYY-MM-DD' (null 이면 팝업 쪽에서 캘린더를 렌더하지 않는다)
  shipEnd: string | null;
  reserveDeadline: string | null;
}

interface Ymd {
  y: number;
  m: number; // 1~12
  d: number;
}

function parseYmd(value: string | null): Ymd | null {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** 비교용 정수 키 (YYYYMMDD) — 문자열 파싱과 무관하게 안전 비교 */
function keyOf(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}

/** 해당 월 1일의 요일 (0=일 … 6=토), UTC 기준 */
function firstWeekday(y: number, m: number): number {
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

/** 해당 월의 일수, UTC 기준 */
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_MONTHS = 2;

function MonthGrid({
  y,
  m,
  startKey,
  endKey,
  reserveKey,
}: {
  y: number;
  m: number;
  startKey: number;
  endKey: number;
  reserveKey: number | null;
}) {
  const lead = firstWeekday(y, m);
  const total = daysInMonth(y, m);

  const cells: Array<number | null> = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <p className="mb-2 text-center text-sm font-semibold text-ink">
        {y}년 {m}월
      </p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-xs font-medium text-muted">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} className="aspect-square" />;
          const dayKey = keyOf(y, m, d);
          const inShip = dayKey >= startKey && dayKey <= endKey;
          const isReserve = reserveKey !== null && dayKey === reserveKey;
          return (
            <div
              key={d}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums",
                inShip
                  ? "bg-brand font-semibold text-white"
                  : isReserve
                    ? "font-semibold text-brand"
                    : "text-ink",
                isReserve && "ring-2 ring-inset",
                isReserve && (inShip ? "ring-white" : "ring-brand")
              )}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PromoCalendar({
  shipStart,
  shipEnd,
  reserveDeadline,
}: PromoCalendarProps) {
  const start = parseYmd(shipStart);
  if (!start) return null;

  // shipEnd 가 없으면 시작일 단일. 혹시 end<start 인 경우도 방어적으로 정렬.
  const endParsed = parseYmd(shipEnd) ?? start;
  const startFirst =
    keyOf(start.y, start.m, start.d) <= keyOf(endParsed.y, endParsed.m, endParsed.d);
  const lo = startFirst ? start : endParsed;
  const hi = startFirst ? endParsed : start;

  const startKey = keyOf(lo.y, lo.m, lo.d);
  const endKey = keyOf(hi.y, hi.m, hi.d);

  const reserve = parseYmd(reserveDeadline);
  const reserveKey = reserve ? keyOf(reserve.y, reserve.m, reserve.d) : null;

  const totalMonths = (hi.y - lo.y) * 12 + (hi.m - lo.m) + 1;
  const monthsToShow = Math.min(totalMonths, MAX_MONTHS);
  const overflow = totalMonths > MAX_MONTHS;

  const months: Array<{ y: number; m: number }> = [];
  for (let i = 0; i < monthsToShow; i += 1) {
    const y = lo.y + Math.floor((lo.m - 1 + i) / 12);
    const m = ((lo.m - 1 + i) % 12) + 1;
    months.push({ y, m });
  }

  // 예약 마감 범례는 표시되는 달 안에 마감일이 있을 때만.
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const shownStartKey = keyOf(firstMonth.y, firstMonth.m, 1);
  const shownEndKey = keyOf(
    lastMonth.y,
    lastMonth.m,
    daysInMonth(lastMonth.y, lastMonth.m)
  );
  const reserveVisible =
    reserveKey !== null && reserveKey >= shownStartKey && reserveKey <= shownEndKey;

  return (
    <div>
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          months.length === 2 && "sm:grid-cols-2"
        )}
      >
        {months.map(({ y, m }) => (
          <MonthGrid
            key={`${y}-${m}`}
            y={y}
            m={m}
            startKey={startKey}
            endKey={endKey}
            reserveKey={reserveVisible ? reserveKey : null}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-brand" aria-hidden="true" />
          발송 기간
        </span>
        {reserveVisible && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded ring-2 ring-inset ring-brand"
              aria-hidden="true"
            />
            예약 마감
          </span>
        )}
      </div>

      {overflow && (
        <p className="mt-2 text-center text-xs text-muted">이후 순차 발송</p>
      )}
    </div>
  );
}
