export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPING' | 'DONE' | 'CANCELED';
// PENDING 결제대기 / PAID 결제완료(신규주문) / SHIPPING 배송중 / DONE 배송완료 / CANCELED 취소

/** v2.1 카드뉴스형 상세페이지 블록 — SPEC v2.1 부록 참고 */
export type DetailBlock =
  | { type: 'heading'; label?: string; title: string }                  // 섹션 라벨(pill) + 큰 제목
  | { type: 'text'; body: string }                                      // 문단 (빈 줄 = 문단 구분)
  | { type: 'image'; url: string; caption?: string }                    // 풀폭 이미지 (긴 상세이미지 재사용 가능)
  | { type: 'point'; title: string; body: string; imageUrl?: string }   // Point N — 렌더 시 자동 번호
  | { type: 'badge'; title: string; body: string; imageUrl?: string }   // 인증·수상 배지
  | { type: 'specs'; title?: string; rows: { k: string; v: string }[] } // 규격/구성 표
  | { type: 'notice'; title: string; body: string };                    // 강조 안내 박스 (포장/예약 등)

export interface Product {
  id: string;              // 'naju-pear' 같은 슬러그 또는 랜덤 id
  name: string;            // 예: "나주배"
  subtitle: string;        // 예: "아삭하고 과즙 가득, 산지에서 바로 보내드려요"
  imageUrl: string | null; // null이면 브랜드 일러스트 placeholder 렌더
  detail: string;          // (구) 단순 본문. blocks 비어 있을 때의 폴백
  blocks: DetailBlock[];   // v2.1: 카드뉴스형 상세페이지 블록 (jsonb, 기본 [])
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

/** v2.2 구매자 포토 리뷰 — SPEC v2.2 부록 참고 */
export type ReviewStatus = 'VISIBLE' | 'HIDDEN';

export interface Review {
  id: string;            // uuid
  productId: string;
  orderNo: string;       // 주문당 1개 (unique)
  authorName: string;    // 주문자명 원본 저장. 화면 표시는 항상 마스킹(김*원)
  phone: string;         // 숫자만. 검증용 — API 응답·화면에 절대 노출 금지
  rating: number;        // 1~5 정수
  body: string;          // 10~2000자
  photos: string[];      // Storage 공개 URL 최대 3개
  status: ReviewStatus;  // 기본 VISIBLE, 관리자가 숨김 가능
  createdAt: string;
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
