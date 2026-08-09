import { NextResponse } from 'next/server';
import { runChat, type ChatMessage } from '@/lib/chat';

export const runtime = 'nodejs';

/**
 * v2.3 AI 상담 챗봇 API — SPEC v2.3 부록.
 * body: { messages: { role: 'user'|'assistant', content: string }[] }
 * 성공: { reply }. 키 없으면 503, 검증 실패 400, 레이트리밋 429 (모두 한국어).
 */

const MAX_MESSAGES = 12;
const MAX_CONTENT_LENGTH = 500;
// 12개 × 500자(UTF-8 한글 최대 3바이트) + JSON 오버헤드를 넉넉히 덮는 상한
const MAX_BODY_BYTES = 32 * 1024;

const RATE_WINDOW_MS = 10 * 60 * 1000; // 10분
const RATE_MAX_REQUESTS = 20;

type RateEntry = { count: number; resetAt: number };

/** dev HMR·모듈 재평가에도 유지되도록 globalThis 에 저장 */
const globalRate = globalThis as typeof globalThis & {
  __limfruitsChatRate?: { map: Map<string, RateEntry>; lastCleanup: number };
};

function getRateState() {
  if (!globalRate.__limfruitsChatRate) {
    globalRate.__limfruitsChatRate = { map: new Map(), lastCleanup: Date.now() };
  }
  return globalRate.__limfruitsChatRate;
}

/** IP당 10분 20회. 허용이면 true. 만료 엔트리는 주기적으로 정리(타이머 없이 요청 시점에). */
function allowRequest(ip: string): boolean {
  const state = getRateState();
  const now = Date.now();
  if (now - state.lastCleanup > RATE_WINDOW_MS) {
    for (const [key, entry] of state.map) {
      if (entry.resetAt <= now) {
        state.map.delete(key);
      }
    }
    state.lastCleanup = now;
  }
  const entry = state.map.get(ip);
  if (!entry || entry.resetAt <= now) {
    state.map.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX_REQUESTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

function clientIp(req: Request): string {
  // Vercel 이 실제 클라이언트 IP 로 설정하는 헤더를 우선 사용.
  // x-forwarded-for 왼쪽 항목은 클라이언트가 임의로 넣을 수 있어 폴백으로만 쓴다.
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) {
    const first = vercel.split(',')[0]?.trim();
    if (first) return first;
  }
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function errorJson(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** 검증 통과 시 최근 12개로 자른 메시지 배열, 실패 시 한국어 에러 문자열 */
function validateMessages(
  body: unknown
): { ok: true; messages: ChatMessage[] } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  }
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: '메시지를 입력해 주세요.' };
  }
  // 12개 초과는 400이 아니라 앞을 잘라 최근 12개만 사용 (SPEC v2.3)
  const sliced = raw.slice(-MAX_MESSAGES);

  const messages: ChatMessage[] = [];
  for (const item of sliced) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
    }
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') {
      return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, error: '메시지 내용을 입력해 주세요.' };
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return {
        ok: false,
        error: `메시지는 ${MAX_CONTENT_LENGTH}자 이내로 입력해 주세요.`,
      };
    }
    messages.push({ role, content });
  }
  if (messages[messages.length - 1].role !== 'user') {
    return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  }
  // Anthropic Messages API는 첫 메시지가 user여야 한다.
  // 최근 12개로 자른 창이 assistant로 시작하면 (13개 이상 대화에서 발생) 앞을 더 잘라낸다.
  while (messages.length > 0 && messages[0].role === 'assistant') {
    messages.shift();
  }
  return { ok: true, messages };
}

export async function POST(req: Request) {
  // 키 없으면 위젯도 렌더되지 않지만, 직접 호출에 대비해 503 을 보장한다
  if (!process.env.ANTHROPIC_API_KEY) {
    return errorJson('상담 기능을 준비 중입니다.', 503);
  }

  if (!allowRequest(clientIp(req))) {
    return errorJson(
      '요청이 너무 잦습니다. 10분 뒤에 다시 시도해 주세요.',
      429
    );
  }

  // content-length 는 클라이언트 제공 값이라 사전 차단용으로만 쓰고,
  // chunked 요청(헤더 부재) 우회에 대비해 실제 본문 길이를 다시 검사한다.
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) {
    return errorJson('요청이 너무 큽니다. 메시지를 줄여 주세요.', 400);
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return errorJson('요청 형식이 올바르지 않습니다.', 400);
  }
  if (text.length > MAX_BODY_BYTES) {
    return errorJson('요청이 너무 큽니다. 메시지를 줄여 주세요.', 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorJson('요청 형식이 올바르지 않습니다.', 400);
  }

  const validated = validateMessages(body);
  if (!validated.ok) {
    return errorJson(validated.error, 400);
  }

  const result = await runChat(validated.messages);
  if (result.status !== 200) {
    return errorJson(result.message, result.status);
  }
  return NextResponse.json({ reply: result.reply });
}
