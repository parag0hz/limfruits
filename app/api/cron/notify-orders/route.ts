import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { sendSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 오늘 0시의 UTC 타임스탬프 */
function kstStartOfTodayUtc(now: number): number {
  const kst = new Date(now + KST_OFFSET_MS);
  return (
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
    KST_OFFSET_MS
  );
}

/**
 * GET|POST /api/cron/notify-orders
 * Supabase pg_cron이 4시간마다 호출한다 (supabase/cron.sql 참고).
 * 최근 N시간(NOTIFY_WINDOW_HOURS, 기본 4시간) 동안 결제된 신규 주문 수를
 * 세서 판매자(NOTIFY_PHONE)에게 문자로 알린다. 0건이면 발송하지 않는다
 * (NOTIFY_ALWAYS=1이면 0건도 발송).
 *
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 ?secret=<CRON_SECRET>
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET이 설정되지 않았습니다." },
      { status: 503 }
    );
  }
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const windowHours = Math.max(
    1,
    Math.min(24, Number(process.env.NOTIFY_WINDOW_HOURS) || 4)
  );
  const now = Date.now();
  const windowStart = now - windowHours * 60 * 60 * 1000;
  const todayStart = kstStartOfTodayUtc(now);

  const store = getStore();
  const orders = await store.listOrders();

  // "신규 주문" = 결제가 완료된 주문 (paidAt 기준. 이후 발송 처리돼도 카운트 유지)
  const paidOrders = orders.filter(
    (o) => o.paidAt !== null && o.status !== "CANCELED"
  );
  const windowOrders = paidOrders.filter(
    (o) => Date.parse(o.paidAt as string) >= windowStart
  );
  const todayCount = paidOrders.filter(
    (o) => Date.parse(o.paidAt as string) >= todayStart
  ).length;
  const windowAmount = windowOrders.reduce((s, o) => s + o.totalAmount, 0);

  const always = process.env.NOTIFY_ALWAYS === "1";
  if (windowOrders.length === 0 && !always) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `최근 ${windowHours}시간 신규 주문 없음`,
      todayCount,
    });
  }

  const to = process.env.NOTIFY_PHONE ?? "010-2618-5151";
  // 90바이트(한글 약 45자) 이내로 유지 → 단문(SMS) 요금
  const message = `[임과일] 신규주문 ${windowOrders.length}건 (오늘 ${todayCount}건, ${Math.round(windowAmount / 10000)}만원)`;

  const sms = await sendSms(to, message);

  return NextResponse.json({
    ok: true,
    windowHours,
    newOrders: windowOrders.length,
    todayCount,
    windowAmount,
    message,
    sms,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
