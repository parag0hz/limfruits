// 주문완료 페이지 열람 토큰 (서버 전용, node 런타임)
//
// /order/complete/[orderNo]는 URL만으로 열리는 페이지라, 주문번호 열거만으로
// 수취인 이름·주소·메모가 노출되지 않도록 결제 성공 리다이렉트 시점에
// 해당 주문번호에 한정된 단기 HMAC 토큰을 쿼리로 실어 보내고 페이지에서 검증한다.
// 토큰이 없거나 만료되면 최소 정보(주문번호·안내)만 보여주고
// 상세 확인은 전화번호 검증이 있는 /order/lookup으로 유도한다.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 토큰 유효시간: 1시간 (결제 직후 확인 + 새로고침 정도만 허용) */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * 서명 키: AUTH_SECRET 우선, 없으면 프로세스 시작 시 생성한 랜덤 키.
 * (발급(success 페이지)과 검증(complete 페이지) 모두 같은 node 렌더 프로세스에서
 *  실행되므로 globalThis 캐시 랜덤 키로 충분하다. 서버 재시작 시 기존 토큰은
 *  만료 취급되지만, 그 경우에도 최소 정보 화면 + 주문조회 유도로 동작한다.)
 */
function secret(): Buffer {
  const env = process.env.AUTH_SECRET;
  if (env) return Buffer.from(env, 'utf8');
  const g = globalThis as { __limfruitsOrderTokenSecret?: Buffer };
  if (!g.__limfruitsOrderTokenSecret) {
    g.__limfruitsOrderTokenSecret = randomBytes(32);
  }
  return g.__limfruitsOrderTokenSecret;
}

function sign(orderNo: string, expiresAt: string): string {
  return createHmac('sha256', secret())
    .update(`limfruits-order-view|${orderNo}|${expiresAt}`)
    .digest('base64url');
}

/** orderNo에 한정된 열람 토큰 발급: "<만료시각ms>.<HMAC>" */
export function createOrderViewToken(orderNo: string): string {
  const expiresAt = String(Date.now() + TOKEN_TTL_MS);
  return `${expiresAt}.${sign(orderNo, expiresAt)}`;
}

/** 열람 토큰 검증 — orderNo 일치 + 미만료 + 서명 유효일 때만 true */
export function verifyOrderViewToken(
  orderNo: string,
  token: string | undefined | null
): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expiresAt = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expiresMs = Number(expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs < Date.now()) return false;
  const expected = Buffer.from(sign(orderNo, expiresAt), 'utf8');
  const actual = Buffer.from(mac, 'utf8');
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}
