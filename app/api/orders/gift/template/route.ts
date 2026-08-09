import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

/** 받는 분 명단 엑셀 양식의 헤더 순서 — 클라이언트 파서가 이 헤더명으로 열을 찾는다. */
const HEADERS = [
  '받는분성명',
  '전화번호',
  '우편번호',
  '주소',
  '상세주소',
  '상품옵션',
  '수량',
  '선물메시지',
] as const;

/**
 * GET /api/orders/gift/template
 * 받는 분 명단 빈 엑셀 양식 다운로드. 헤더 + 작성 예시 1행.
 * (인증 불필요 — 빈 양식일 뿐)
 */
export async function GET() {
  const example: Record<(typeof HEADERS)[number], string | number> = {
    받는분성명: '홍길동',
    전화번호: '010-1234-5678',
    우편번호: '58326',
    주소: '전라남도 나주시 덕룡로 33-8',
    상세주소: '101동 1001호',
    상품옵션: '선물세트 5kg',
    수량: 1,
    선물메시지: '건강하세요',
  };

  const ws = XLSX.utils.json_to_sheet([example], {
    header: HEADERS as unknown as string[],
  });
  ws['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 8 },
    { wch: 32 },
    { wch: 18 },
    { wch: 20 },
    { wch: 6 },
    { wch: 24 },
  ];
  // 전화번호(B)·우편번호(C)는 텍스트로 다뤄야 선행 0(예: 010, 01000)이 보존된다.
  // 예시 셀을 텍스트 서식으로 지정해 엑셀이 숫자로 변환하지 않도록 유도한다.
  if (ws['B2']) ws['B2'].z = '@';
  if (ws['C2']) ws['C2'].z = '@';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '받는분명단');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const filename = 'limfruits-gift-recipients.xlsx';
  const korName = encodeURIComponent('임과일_받는분명단_양식.xlsx');

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${korName}`,
      'Cache-Control': 'no-store',
    },
  });
}
