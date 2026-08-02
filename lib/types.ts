export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPING' | 'DONE' | 'CANCELED';
// PENDING 결제대기 / PAID 결제완료(신규주문) / SHIPPING 배송중 / DONE 배송완료 / CANCELED 취소

export interface Product {
  id: string;              // 'naju-pear' 같은 슬러그 또는 랜덤 id
  name: string;            // 예: "나주배"
  subtitle: string;        // 예: "아삭하고 과즙 가득, 산지에서 바로 보내드려요"
  imageUrl: string | null; // null이면 브랜드 일러스트 placeholder 렌더
  detail: string;          // 상세 본문. 빈 줄로 문단 구분하는 플레인 텍스트
  isActive: boolean;       // false면 카탈로그/상세 비노출 (admin에서만 보임)
  sortOrder: number;
}

export interface ProductOption {
  id: string;
  productId: string;
  name: string;         // 예: "가정용 3kg" (상품에 소속되므로 상품명 중복 제거)
  description: string;  // 예: "5~7과 · 실속 가정용"
  price: number;        // 원 단위 정수, 배송비 포함가
  soldOut: boolean;
  sortOrder: number;
}

export interface OrderItem {
  productId: string;
  productName: string;  // 주문 시점 스냅샷
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
