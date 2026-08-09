'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 봇 답변의 [페이지 이름](/경로) 를 클릭 가능한 내부 링크로 렌더.
 * 경로가 "/" 로 시작하는 내부 링크만 허용 — 외부 URL은 링크가 되지 않는다.
 */
const INTERNAL_LINK = /\[([^\]]+)\]\((\/[^\s)]*)\)/g;

function renderBotText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INTERNAL_LINK)) {
    const [full, label, path] = match;
    const idx = match.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <a
        key={`${idx}-${path}`}
        href={path}
        className="font-semibold text-brand-dark underline underline-offset-2 hover:text-brand"
      >
        {label}
      </a>
    );
    last = idx + full.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const STORAGE_KEY = 'limfruits_chat';
const MAX_HISTORY = 12;
const MAX_LENGTH = 500;

const SUGGESTIONS = [
  '어떤 상품이 있나요?',
  '주문 배송 조회하고 싶어요',
  '선물용으로 뭐가 좋아요?',
];

const GENERIC_ERROR = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.role === 'user' || v.role === 'assistant') &&
    typeof v.content === 'string'
  );
}

/**
 * sessionStorage 복원 — 서버에서는 빈 배열.
 * 메시지 목록은 열림 상태(클릭 후, 즉 하이드레이션 이후)에만 렌더되므로
 * 초기 렌더 마크업이 서버와 달라질 일이 없어 lazy initializer로 안전하게 읽는다.
 */
function readStoredMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isChatMessage) : [];
  } catch {
    // 저장소 접근 불가·손상 데이터는 무시하고 새 대화로 시작
    return [];
  }
}

/**
 * AI 상담 챗 위젯 (SPEC v2.3 부록).
 * 우측 하단 플로팅 버튼 → 데스크톱 380×560 카드 / 모바일 인셋 시트.
 * 대화는 sessionStorage에 유지하고, 서버에는 최근 12개만 보낸다.
 * 버튼 위치: 상품 상세는 하단 구매 바(sticky z-40, 데스크톱·모바일 모두 노출) 위로
 * 5.5rem 띄우고, 주문/선물 결제 페이지는 결제 바(에러 시 높이 가변)와 겹치므로 버튼을 숨긴다.
 * 그 외(홈 등)는 우하단 여백을 넉넉히 둬(모바일 bottom 2rem / 데스크톱 2rem)
 * 카탈로그 카드 위에 얹혀 보이지 않게 한다.
 */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(readStoredMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // iOS 키보드가 레이아웃 뷰포트 위에 겹칠 때 가려지는 하단 높이(px)
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  const pathname = usePathname();
  // 하단 구매 바가 있는 상품 상세에서만 버튼을 바 위로 띄운다(바는 데스크톱에도 노출)
  const hasBuyBar = pathname?.startsWith('/products/') ?? false;
  // 하단 고정 결제 바가 있는 주문/선물 결제 페이지는 버튼과 겹치므로 숨긴다.
  // (/order/lookup·/order/complete 에는 고정 결제 바가 없으므로 두 경로만 정확히 제외)
  const hideLauncher = pathname === '/order' || pathname === '/order/gift';

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // 저장 실패는 무시 (시크릿 모드 등)
    }
  }, [messages]);

  // 새 메시지·로딩·에러 시 목록 맨 아래로
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, error, open]);

  // 열면 입력창 포커스, 닫으면 런처 버튼으로 포커스 복귀
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      inputRef.current?.focus();
    } else if (wasOpenRef.current) {
      launcherRef.current?.focus();
    }
  }, [open]);

  // iOS Safari 키보드는 레이아웃 뷰포트를 줄이지 않고 위에 겹치므로,
  // visualViewport 로 가려진 높이만큼 모바일 시트의 bottom 을 보정한다.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // 데스크톱 카드(sm 이상)는 보정하지 않는다 (핀치 줌 오동작 방지)
      if (window.matchMedia('(min-width: 640px)').matches) {
        setKeyboardOffset(0);
        return;
      }
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(hidden > 0 ? Math.round(hidden) : 0);
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setKeyboardOffset(0);
    };
  }, [open]);

  async function request(history: ChatMessage[]) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
      });
      const data: unknown = await res.json().catch(() => null);
      const body = (data ?? {}) as Record<string, unknown>;
      if (res.ok && typeof body.reply === 'string') {
        const reply = body.reply;
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setError(typeof body.error === 'string' ? body.error : GENERIC_ERROR);
      }
    } catch {
      setError('네트워크 연결을 확인해 주세요.');
    } finally {
      setSending(false);
    }
  }

  function send(text: string) {
    const content = text.trim().slice(0, MAX_LENGTH);
    if (!content || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    void request(next);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  // 직전 실패한 대화(마지막이 user 메시지)를 그대로 다시 보낸다.
  function retry() {
    if (sending || messages.length === 0) return;
    void request(messages);
  }

  return (
    <>
      {!open && !hideLauncher && (
        <button
          ref={launcherRef}
          type="button"
          aria-label="상담 열기"
          onClick={() => setOpen(true)}
          className={`fixed right-4 z-[60] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-brand text-white shadow-lg transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:right-6 ${
            hasBuyBar
              ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]'
              : 'bottom-[calc(2rem+env(safe-area-inset-bottom))] lg:bottom-8'
          }`}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.2-.6L4 21l1.3-4.1A8.1 8.1 0 0 1 4 11.5 8.38 8.38 0 0 1 12.5 3.2 8.38 8.38 0 0 1 21 11.5Z" />
          </svg>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="임과일 상담"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          style={keyboardOffset > 0 ? { bottom: keyboardOffset } : undefined}
          className="fixed inset-x-0 top-14 bottom-0 z-[60] flex flex-col overflow-hidden rounded-t-2xl border border-hairline bg-white shadow-xl sm:inset-auto sm:top-auto sm:right-6 sm:bottom-6 sm:h-[560px] sm:max-h-[calc(100dvh-6rem)] sm:w-[380px] sm:rounded-2xl"
        >
          {/* 헤더 */}
          <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
            <p className="text-sm font-semibold text-ink">임과일 상담</p>
            <button
              type="button"
              aria-label="상담 닫기"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* 메시지 목록 */}
          <div
            ref={listRef}
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-ink">
              안녕하세요, 임과일입니다. 상품이나 주문에 대해 궁금한 점을
              물어보세요.
            </div>

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    disabled={sending}
                    className="cursor-pointer rounded-full border border-hairline bg-white px-3 py-1.5 text-sm text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-white">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">
                    {renderBotText(m.content)}
                  </div>
                </div>
              )
            )}

            {sending && (
              <div className="flex justify-start">
                <div
                  role="status"
                  className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface px-3.5 py-3"
                  aria-label="답변 작성 중"
                >
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                </div>
              </div>
            )}

            {error && !sending && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
                  <p>{error}</p>
                  {messages[messages.length - 1]?.role === 'user' && (
                    <button
                      type="button"
                      onClick={retry}
                      className="mt-1.5 cursor-pointer text-sm font-semibold text-danger underline underline-offset-2"
                    >
                      다시 시도
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 입력 영역 */}
          <div className="shrink-0 border-t border-hairline px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={MAX_LENGTH}
                placeholder="메시지를 입력해 주세요"
                aria-label="상담 메시지 입력"
                className="min-w-0 flex-1 rounded-full border border-hairline bg-white px-4 py-2.5 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                aria-label="전송"
                disabled={sending || input.trim().length === 0}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </form>
            <p className="pt-2 text-center text-[11px] text-muted">
              AI 상담이 정확하지 않을 수 있어요 · 문의 010-2618-5151
            </p>
          </div>
        </div>
      )}
    </>
  );
}
