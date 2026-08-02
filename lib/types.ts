export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPING' | 'DONE' | 'CANCELED';
// PENDING 결제대기 / PAID 결제완료(신규주문) / SHIPPING 배송중 / DONE 배송완료 / CANCELED 취소

export interface ProductOption {
  id: string;
  name: string;         // 예: "나주배 선물세트 5kg"
  description: string;  // 예: "7~9과 · 명절 선물용"
  price: number;        // 원 단위 정수, 배송비 포함가
  soldOut: boolean;
  sortOrder: number;
}

export interface OrderItem {
  optionId: string;
  optionName: string;   // 주문 시점 스냅샷
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNo: string;      // "LF-YYYYMMDD-XXXXXXXX" (대문자 영숫자 8자리 랜덤)
  status: OrderStatus;
  customerName: string;
  phone: string;        // 숫자만 저장 (01012345678)
  postcode: string;
  address1: string;
  address2: string;
  memo: string;
  items: OrderItem[];
  totalAmount: number;
  paymentKey: string | null;
  paymentMethod: string | null; // 토스 응답 method (카드/간편결제 등)
  paidAt: string | null;        // ISO
  courier: string | null;       // 택배사명
  trackingNo: string | null;
  createdAt: string;            // ISO
}
