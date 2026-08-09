/**
 * 문자(SMS) 발송 — 알리고(https://smartsms.aligo.in) REST API.
 * 환경변수(ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER)가 없으면
 * 실제 발송 대신 드라이런으로 동작한다 (서버 로그에만 남김).
 *
 * 발신번호(ALIGO_SENDER)는 알리고에 사전 등록된 번호여야 한다.
 */

export interface SmsResult {
  sent: boolean;
  dryRun: boolean;
  detail: string;
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const key = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;

  if (!key || !userId || !sender) {
    console.log(`[sms dry-run] to=${to} msg=${message}`);
    return {
      sent: false,
      dryRun: true,
      detail: "알리고 환경변수 미설정 — 드라이런 (로그만 남김)",
    };
  }

  const form = new URLSearchParams({
    key,
    user_id: userId,
    sender,
    receiver: to.replace(/[^0-9]/g, ""),
    msg: message,
    msg_type: "SMS",
  });

  const res = await fetch("https://apis.aligo.in/send/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = (await res.json().catch(() => null)) as {
    result_code?: string | number;
    message?: string;
  } | null;

  const ok = data != null && String(data.result_code) === "1";
  if (!ok) {
    console.error("[sms] 발송 실패:", data);
  }
  return {
    sent: ok,
    dryRun: false,
    detail: ok ? "발송 성공" : `발송 실패: ${data?.message ?? "응답 해석 불가"}`,
  };
}
