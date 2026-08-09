import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { getStore } from './db';
import { formatDateTime, formatWon, normalizePhone } from './format';
import type { OrderStatus } from './types';

/**
 * v2.3 AI 상담 챗봇 — Claude tool-use 에이전트 (SPEC v2.3 부록).
 * 도구 2개(list_products, get_order_status)와 runChat 을 제공한다.
 * ANTHROPIC_API_KEY 가 없으면 route 가 이 모듈을 호출하기 전에 503 을 반환한다.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatResult =
  | { status: 200; reply: string }
  | { status: 500 | 503; message: string };

/**
 * 시스템 프롬프트 — SPEC v2.3 부록 "시스템 프롬프트에 넣을 사실" 그대로.
 * 여기 없는 구체 수치는 말하지 않도록 지어내기 방지 규칙을 함께 넣는다.
 */
export const SYSTEM_PROMPT = `당신은 임과일의 AI 상담원입니다. 임과일은 풍천대봉감농원(전남 나주시 덕룡로 33-8)이 운영하는 과일 직판 온라인 스토어입니다. 신고배·풍수배·황금배를 재배하고 도라지배즙을 판매하며, GAP 우수관리인증 제1006050호를 보유하고 있습니다.

기본 안내 사실:
- 표시 가격은 모두 배송비가 포함된 금액입니다.
- 주문 확인 후 산지에서 발송하며, 명절 성수기에는 주문 순서대로 순차 발송합니다.
- 농산물 특성상 크기와 모양이 사진과 다를 수 있습니다.
- 배는 수령 후 냉장 보관을 권장합니다.
- 문의 전화는 010-2618-5151, 카카오톡은 limcon1 입니다. 주문조회 페이지는 /order/lookup 입니다.

도구 사용 규칙:
- 상품·가격·품절에 관한 질문에는 반드시 list_products 도구를 먼저 호출하고, 그 결과에 있는 내용으로만 답합니다. 기억이나 추측으로 상품·가격을 말하지 않습니다.
- 주문 상태 문의에는 주문번호와 전화번호가 모두 필요합니다. 두 값을 모두 확보한 뒤에만 get_order_status 도구를 호출하고, 하나라도 없으면 정중히 요청합니다.
- 도구 결과에 "주문을 찾을 수 없음"이 오면 주문번호와 전화번호를 다시 확인해 달라고 안내합니다.
- 위 사실과 도구 결과에 없는 구체적인 수치나 정보는 만들어 말하지 않습니다.

응대 원칙:
- 환불·취소·결제 문제는 상담원이 직접 처리할 수 없습니다. 전화 010-2618-5151 로 안내합니다.
- 배송 소요일처럼 확정되지 않은 정보는 단정하지 말고 전화 문의를 안내합니다.
- 과일 및 주문과 무관한 질문에는 짧고 정중하게 답변을 사양합니다.
- 주소·카드번호 등 개인정보는 묻지도, 저장하지도 않습니다.
- 존댓말을 사용하고 2~4문장으로 간결하게 답합니다. 이모지와 느낌표는 사용하지 않습니다.
- 별표·불릿 등 마크다운 서식 없이 일반 텍스트 문장으로만 답합니다. 단 하나의 예외로, 사이트 안의 페이지를 안내할 때는 반드시 [페이지 이름](/경로) 형식을 씁니다. 예: [주문조회 페이지](/order/lookup), [나주배 상품 페이지](/products/naju-pear). /order/lookup 같은 경로 문자열을 이 형식 밖에 그대로 노출하지 않습니다.`;

const STATUS_KO: Record<OrderStatus, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  SHIPPING: '배송 중',
  DONE: '배송 완료',
  CANCELED: '취소',
};

/** 활성 상품 + 옵션(가격·품절) 조회 — 상품/가격/재고 질문의 유일한 근거 */
const listProducts = betaTool({
  name: 'list_products',
  description:
    '판매 중인 상품·옵션·가격·품절 여부를 조회한다. 상품/가격/재고 질문에는 반드시 이 도구를 먼저 호출한다.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  run: async () => {
    try {
      const store = getStore();
      const [products, options] = await Promise.all([
        store.listProducts(),
        store.listOptions(),
      ]);
      const result = products.map((p) => ({
        상품명: p.name,
        부제: p.subtitle,
        상세페이지: `/products/${p.id}`,
        옵션: options
          .filter((o) => o.productId === p.id)
          .map((o) => ({
            이름: o.name,
            가격: o.price,
            품절: o.soldOut,
          })),
      }));
      return JSON.stringify(result);
    } catch (e) {
      console.error('[limfruits] chat list_products 조회 실패:', e);
      return JSON.stringify({
        오류: '상품 정보를 조회하지 못했습니다. 잠시 후 다시 시도해 달라고 안내하세요.',
      });
    }
  },
});

/**
 * 주문번호 + 전화번호로 주문 상태 조회.
 * 주소·전화번호 등 개인정보는 결과에 절대 포함하지 않는다 (allowlist 방식).
 */
const getOrderStatus = betaTool({
  name: 'get_order_status',
  description:
    '주문번호와 전화번호로 주문 상태를 조회한다. 두 값이 모두 확보된 경우에만 호출한다.',
  inputSchema: {
    type: 'object',
    properties: {
      orderNo: {
        type: 'string',
        description: '주문번호 (예: LF-20260809-ABCDEFGH)',
      },
      phone: {
        type: 'string',
        description: '주문 시 입력한 전화번호 (하이픈 유무 무관)',
      },
    },
    required: ['orderNo', 'phone'],
    additionalProperties: false,
  },
  run: async ({ orderNo, phone }) => {
    try {
      const order = await getStore().findOrder(
        orderNo.trim().toUpperCase(),
        normalizePhone(phone)
      );
      if (!order) {
        return JSON.stringify({
          결과: '주문을 찾을 수 없음',
          안내: '주문번호와 전화번호가 주문 정보와 일치하는지 다시 확인해 달라고 안내하세요.',
        });
      }
      return JSON.stringify({
        상태: STATUS_KO[order.status],
        주문일: formatDateTime(order.createdAt),
        상품: order.items
          .map((i) => `${i.productName} ${i.optionName} ${i.quantity}개`)
          .join(', '),
        금액: formatWon(order.totalAmount),
        택배사: order.courier,
        운송장번호: order.trackingNo,
      });
    } catch (e) {
      console.error('[limfruits] chat get_order_status 조회 실패:', e);
      return JSON.stringify({
        오류: '주문 정보를 조회하지 못했습니다. 잠시 후 다시 시도해 달라고 안내하세요.',
      });
    }
  },
});

const ALLOWED_EFFORTS = ['low', 'medium', 'high'] as const;
type ChatEffort = (typeof ALLOWED_EFFORTS)[number];

function resolveEffort(): ChatEffort {
  const raw = process.env.CHAT_EFFORT;
  return (ALLOWED_EFFORTS as readonly string[]).includes(raw ?? '')
    ? (raw as ChatEffort)
    : 'low';
}

/**
 * 대화 이력을 받아 Claude tool-use 에이전트를 실행하고 응답 텍스트를 돌려준다.
 * Anthropic 에러는 { status, message } 로 정규화한다 (원문 메시지 노출 금지).
 * claude-opus-5 는 thinking 이 기본 켜져 있으므로 thinking 파라미터를 보내지 않는다.
 */
export async function runChat(messages: ChatMessage[]): Promise<ChatResult> {
  const model = process.env.CHAT_MODEL || 'claude-opus-5';
  const effort = resolveEffort();
  // claude-haiku-4-5 는 effort 파라미터를 지원하지 않아 보내면 400이 난다.
  // CHAT_MODEL=claude-haiku-4-5 교체(SPEC 허용)를 위해 지원 모델에만 전송한다.
  const supportsEffort = !model.startsWith('claude-haiku');

  try {
    const client = new Anthropic(); // ANTHROPIC_API_KEY 자동 인식
    const finalMessage = await client.beta.messages.toolRunner({
      model,
      max_tokens: 1024,
      ...(supportsEffort ? { output_config: { effort } } : {}),
      system: SYSTEM_PROMPT,
      tools: [listProducts, getOrderStatus],
      messages,
      max_iterations: 5,
    });

    let reply = '';
    for (const block of finalMessage.content) {
      if (block.type === 'text') {
        reply += block.text;
      }
    }
    // max_tokens 는 thinking + 응답 텍스트 합산 상한이라 답변이 중간에 잘릴 수 있다.
    // 잘린 반쪽 답변이나 빈 응답(max_iterations 도달 등)은 그대로 내보내지 않는다.
    if (finalMessage.stop_reason === 'max_tokens' || !reply.trim()) {
      reply =
        '죄송합니다. 답변을 만들지 못했습니다. 질문을 조금 바꿔 다시 시도해 주시거나 010-2618-5151 로 문의해 주세요.';
    }
    return { status: 200, reply };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { status: 503, message: '상담 기능을 준비 중입니다.' };
    }
    if (
      err instanceof Anthropic.RateLimitError ||
      (err instanceof Anthropic.APIError && err.status === 529)
    ) {
      return {
        status: 503,
        message: '상담이 몰리고 있어요. 잠시 후 다시 시도해 주세요.',
      };
    }
    console.error('[limfruits] chat 응답 생성 실패:', err);
    return {
      status: 500,
      message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
}
