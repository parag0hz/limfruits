// 토스페이먼츠 서버 API 호출 모음 (서버 전용 — 시크릿 키 사용)
// checkout 에이전트 소유. admin 에이전트도 cancelPayment를 import해서 사용.

/**
 * 문서 공개 테스트 시크릿 키 (결제위젯 연동용).
 * 출처: https://docs.tosspayments.com 결제위젯 v2 연동 가이드 및
 * 공식 샘플 저장소 github.com/tosspayments/tosspayments-sample (express-javascript/server.js).
 * 누구나 쓸 수 있는 공개 테스트 키로, 실 결제가 일어나지 않는다. 운영 전 반드시 교체.
 */
const DOCS_TEST_WIDGET_SECRET_KEY = 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';

const TOSS_API_BASE = 'https://api.tosspayments.com';

/** 토스 결제 객체 중 우리가 쓰는 필드만 추린 타입 */
export interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: string; // DONE, CANCELED 등
  method?: string | null; // "카드", "간편결제" 등 한국어 결제수단
  totalAmount: number;
  approvedAt?: string | null;
}

/** 토스 API가 4xx/5xx로 응답했을 때 던지는 에러 (code는 토스 에러 코드) */
export class TossApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'TossApiError';
    this.code = code;
    this.status = status;
  }
}

function secretKey(): string {
  return process.env.TOSS_SECRET_KEY || DOCS_TEST_WIDGET_SECRET_KEY;
}

/** Basic 인증 헤더: base64(secretKey + ":") — 비밀번호 없음 표시로 콜론을 붙인다 */
function authorizationHeader(): string {
  return `Basic ${Buffer.from(`${secretKey()}:`).toString('base64')}`;
}

async function tossFetch(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<TossPayment> {
  let res: Response;
  try {
    res = await fetch(`${TOSS_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: authorizationHeader(),
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new TossApiError(
      'NETWORK_ERROR',
      '결제 서버와 통신하지 못했어요. 잠시 후 다시 시도해 주세요.',
      0
    );
  }

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // 본문이 JSON이 아니면 아래에서 상태코드로 처리
  }

  if (!res.ok) {
    const code = typeof json.code === 'string' ? json.code : 'UNKNOWN';
    const message =
      typeof json.message === 'string'
        ? json.message
        : '결제 처리 중 문제가 발생했어요.';
    throw new TossApiError(code, message, res.status);
  }

  return json as unknown as TossPayment;
}

/**
 * 결제 승인. 반드시 서버(DB)가 계산한 금액을 amount로 넘길 것.
 * @param paymentKey 토스가 successUrl로 넘겨준 paymentKey
 * @param orderId 우리 주문번호 (orderNo)
 * @param amount DB에 저장된 주문 총액 (클라이언트 금액 신뢰 금지)
 */
export async function confirmPayment(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<TossPayment> {
  return tossFetch('POST', '/v1/payments/confirm', {
    paymentKey,
    orderId,
    amount,
  });
}

/**
 * 결제 단건 조회 (GET /v1/payments/{paymentKey}).
 * ALREADY_PROCESSED_PAYMENT처럼 "이미 승인된 결제"를 성공 처리하기 전에
 * 해당 paymentKey가 정말 이 주문의 결제인지(orderId/totalAmount/status) 검증하는 용도.
 */
export async function getPayment(paymentKey: string): Promise<TossPayment> {
  return tossFetch('GET', `/v1/payments/${encodeURIComponent(paymentKey)}`);
}

/**
 * 결제 취소(전액). 관리자가 주문을 CANCELED로 바꿀 때 호출.
 * @param paymentKey 승인 시 저장해 둔 paymentKey
 * @param reason 취소 사유 (토스 cancelReason)
 */
export async function cancelPayment(
  paymentKey: string,
  reason: string
): Promise<TossPayment> {
  return tossFetch(
    'POST',
    `/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
    { cancelReason: reason }
  );
}

/** 토스 에러 코드 → 구매자에게 보여줄 자연스러운 한국어 안내 */
const FRIENDLY_TOSS_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨어요. 준비되시면 다시 시도해 주세요.',
  PAY_PROCESS_ABORTED:
    '결제가 진행 중에 중단되었어요. 잠시 후 다시 시도해 주세요.',
  REJECT_CARD_COMPANY:
    '카드사에서 결제를 거절했어요. 카드 정보를 확인하시거나 다른 카드로 시도해 주세요.',
  REJECT_CARD_PAYMENT:
    '카드 결제가 거절되었어요. 한도나 잔액을 확인해 주세요.',
  INVALID_CARD_NUMBER: '카드 번호를 다시 확인해 주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간을 다시 확인해 주세요.',
  INVALID_STOPPED_CARD: '정지된 카드예요. 다른 카드로 시도해 주세요.',
  EXCEED_MAX_DAILY_PAYMENT_COUNT:
    '하루 결제 가능 횟수를 초과했어요. 내일 다시 시도해 주세요.',
  EXCEED_MAX_PAYMENT_AMOUNT:
    '결제 한도를 초과했어요. 다른 결제수단으로 시도해 주세요.',
  NOT_ENOUGH_BALANCE: '잔액이 부족해요. 다른 결제수단으로 시도해 주세요.',
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT:
    '해당 카드는 할부가 지원되지 않아요. 일시불로 시도해 주세요.',
  NOT_FOUND_PAYMENT: '결제 정보를 찾을 수 없어요. 처음부터 다시 시도해 주세요.',
  NOT_FOUND_PAYMENT_SESSION:
    '결제 시간이 만료되었어요. 처음부터 다시 시도해 주세요.',
  FORBIDDEN_REQUEST:
    '결제 설정에 문제가 있어요. 잠시 후에도 계속되면 판매자에게 문의해 주세요.',
  UNAUTHORIZED_KEY:
    '결제 연동 설정에 문제가 있어요. 판매자에게 문의해 주세요.',
  PROVIDER_ERROR:
    '결제 기관에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 토스 에러 코드를 구매자용 한국어 안내로 순화.
 * 화면에 띄우는 문구는 화이트리스트에서만 고른다 — URL 등 외부에서 들어온 자유 텍스트를
 * 그대로 렌더링하면 판매자 도메인 위에 임의 문구를 띄우는 피싱에 악용될 수 있다.
 * 알 수 없는 코드는 일반 안내로 폴백 (원본 message는 서버 로그로만 남길 것).
 */
export function friendlyTossMessage(code?: string | null): string {
  if (code && FRIENDLY_TOSS_MESSAGES[code]) {
    return FRIENDLY_TOSS_MESSAGES[code];
  }
  return '결제 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.';
}
