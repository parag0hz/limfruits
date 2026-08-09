/** 선물·대량 주문 화면(다중 배송지)에서 공유하는 타입 — v2.4 */

/** 서버(server component)가 넘겨주는 활성 상품 요약 (optgroup 라벨용) */
export interface ProductLite {
  id: string;
  name: string;
}

/** 서버가 넘겨주는 주문 가능한 옵션 (활성 상품 · 재고 있는 옵션만) */
export interface OptionChoice {
  id: string;
  productId: string;
  productName: string;
  name: string;
  description: string;
  price: number;
}

/** 받는 분 카드 1건의 입력 상태 */
export interface RecipientDraft {
  key: string; // 로컬 렌더 키 (React용, 서버 전송 안 함)
  optionId: string;
  quantity: number;
  recipientName: string;
  phone: string;
  postcode: string;
  address1: string;
  address2: string;
  giftMessage: string;
}

/** 받는 분 카드 검증 에러 */
export interface RecipientErrors {
  option?: string;
  name?: string;
  phone?: string;
  address?: string;
  message?: string;
}
