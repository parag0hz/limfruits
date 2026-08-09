'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { normalizePhone } from '@/lib/format';
import Button from '@/components/ui/Button';
import type { OptionChoice, RecipientDraft } from './types';

const MAX_QUANTITY = 99;
const MAX_GIFT_MESSAGE = 200;

/** 양식 헤더명 → draft 필드 매핑용 키 */
const COLUMN_KEYS = {
  받는분성명: 'name',
  전화번호: 'phone',
  우편번호: 'postcode',
  주소: 'address1',
  상세주소: 'address2',
  상품옵션: 'option',
  수량: 'quantity',
  선물메시지: 'message',
} as const;

type ColumnKey = (typeof COLUMN_KEYS)[keyof typeof COLUMN_KEYS];

function normalizeMatch(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

/** 상품옵션 텍스트를 활성 옵션과 매칭 (정확 → 부분) */
function matchOption(
  text: string,
  options: OptionChoice[]
): { option?: OptionChoice; error?: string } {
  const t = normalizeMatch(text);
  if (!t) return { error: '상품옵션이 비어 있습니다' };

  const variants = (o: OptionChoice) => [
    normalizeMatch(o.name),
    normalizeMatch(`${o.productName}${o.name}`),
  ];

  const exact = options.filter((o) => variants(o).includes(t));
  if (exact.length === 1) return { option: exact[0] };
  if (exact.length > 1) return { error: '상품옵션을 특정할 수 없습니다' };

  const partial = options.filter((o) => {
    const on = normalizeMatch(o.name);
    const full = normalizeMatch(`${o.productName}${o.name}`);
    return full.includes(t) || t.includes(on) || on.includes(t);
  });
  if (partial.length === 1) return { option: partial[0] };
  if (partial.length > 1) return { error: '상품옵션을 특정할 수 없습니다' };

  return { error: `상품옵션 "${text.trim()}"을(를) 찾을 수 없습니다` };
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export interface BulkUploadProps {
  options: OptionChoice[];
  remainingSlots: number;
  makeKey: () => string;
  onAdd: (drafts: RecipientDraft[]) => void;
}

/**
 * 엑셀 대량 업로드 — 클라이언트에서 xlsx 파싱 → 유효 행만 카드로 추가.
 * 매칭·검증 실패 행은 "N행: 사유" 목록으로 안내(전체 실패시키지 않음).
 */
export default function BulkUpload({
  options,
  remainingSlots,
  makeKey,
  onAdd,
}: BulkUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setFailures([]);
    setSummary(null);
    setError(null);

    if (file.size > 5 * 1024 * 1024) {
      setError('파일이 너무 커요. 5MB 이하 엑셀 파일로 올려 주세요.');
      return;
    }

    let rows: unknown[][];
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = sheetName ? wb.Sheets[sheetName] : undefined;
      if (!ws) {
        setError('엑셀에서 시트를 찾지 못했어요. 양식 파일인지 확인해 주세요.');
        return;
      }
      rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        blankrows: false,
        defval: '',
      });
    } catch {
      setError('엑셀 파일을 읽지 못했어요. .xlsx 양식 파일인지 확인해 주세요.');
      return;
    }

    if (rows.length < 2) {
      setError('작성된 받는 분 정보가 없어요. 양식에 내용을 채운 뒤 올려 주세요.');
      return;
    }

    // 헤더 행에서 열 위치 찾기
    const headerRow = (rows[0] as unknown[]).map((c) => cellText(c));
    const colIndex: Partial<Record<ColumnKey, number>> = {};
    headerRow.forEach((h, i) => {
      const key = (COLUMN_KEYS as Record<string, ColumnKey>)[h];
      if (key && colIndex[key] === undefined) colIndex[key] = i;
    });

    const missing = (
      Object.keys(COLUMN_KEYS) as (keyof typeof COLUMN_KEYS)[]
    ).filter((h) => colIndex[COLUMN_KEYS[h]] === undefined);
    if (missing.length > 0) {
      setError(
        `양식 헤더를 찾지 못했어요: ${missing.join(', ')}. 양식을 다시 내려받아 작성해 주세요.`
      );
      return;
    }

    const get = (row: unknown[], key: ColumnKey): string => {
      const idx = colIndex[key];
      return idx === undefined ? '' : cellText(row[idx]);
    };

    const drafts: RecipientDraft[] = [];
    const fails: string[] = [];
    let capped = false;

    for (let i = 1; i < rows.length; i++) {
      const rowNo = i + 1; // 스프레드시트 기준 행 번호(헤더 = 1행)
      const row = rows[i] as unknown[];

      const name = get(row, 'name');
      const phoneRaw = get(row, 'phone');
      const postcodeRaw = get(row, 'postcode');
      const address1 = get(row, 'address1');
      const address2 = get(row, 'address2');
      const optionText = get(row, 'option');
      const quantityRaw = get(row, 'quantity');
      const messageRaw = get(row, 'message');

      // 완전히 빈 행은 조용히 건너뜀
      if (
        !name &&
        !phoneRaw &&
        !postcodeRaw &&
        !address1 &&
        !optionText &&
        !quantityRaw
      ) {
        continue;
      }

      if (drafts.length >= remainingSlots) {
        capped = true;
        break;
      }

      if (!name) {
        fails.push(`${rowNo}행: 받는분성명이 비어 있습니다`);
        continue;
      }
      if (name.length > 30) {
        fails.push(`${rowNo}행: 받는분성명이 너무 깁니다(30자 이내)`);
        continue;
      }
      const phone = normalizePhone(phoneRaw);
      if (phone.length < 10 || phone.length > 11 || !phone.startsWith('0')) {
        fails.push(`${rowNo}행: 전화번호 형식이 올바르지 않습니다`);
        continue;
      }
      const postcodeDigits = postcodeRaw.replace(/[^0-9]/g, '');
      if (!postcodeDigits) {
        fails.push(`${rowNo}행: 우편번호가 비어 있습니다`);
        continue;
      }
      // 엑셀이 우편번호를 숫자 셀로 저장하면 선행 0이 사라진다(예: 01000 → 1000).
      // 5자리 미만이면 선행 0을 채워 복원하고, 5자리를 벗어나면 형식 오류로 안내한다.
      const postcode = postcodeDigits.padStart(5, '0');
      if (!/^\d{5}$/.test(postcode)) {
        fails.push(`${rowNo}행: 우편번호는 5자리 숫자여야 합니다`);
        continue;
      }
      if (!address1) {
        fails.push(`${rowNo}행: 주소가 비어 있습니다`);
        continue;
      }
      const { option, error: optErr } = matchOption(optionText, options);
      if (!option) {
        fails.push(`${rowNo}행: ${optErr}`);
        continue;
      }
      let quantity = 1;
      if (quantityRaw) {
        const q = Math.trunc(Number(quantityRaw));
        if (!Number.isFinite(q) || q < 1 || q > MAX_QUANTITY) {
          fails.push(`${rowNo}행: 수량은 1~${MAX_QUANTITY} 사이여야 합니다`);
          continue;
        }
        quantity = q;
      }
      const giftMessage = messageRaw.slice(0, MAX_GIFT_MESSAGE);

      drafts.push({
        key: makeKey(),
        optionId: option.id,
        quantity,
        recipientName: name,
        phone,
        postcode,
        address1,
        address2,
        giftMessage,
      });
    }

    if (drafts.length > 0) onAdd(drafts);

    const parts: string[] = [];
    if (drafts.length > 0) parts.push(`${drafts.length}건을 추가했어요`);
    if (fails.length > 0) parts.push(`${fails.length}건은 확인이 필요해요`);
    if (capped) {
      parts.push(`남은 자리(${remainingSlots}건)를 채워 이후 행은 건너뛰었어요`);
    }
    setSummary(
      parts.length > 0 ? parts.join(' · ') : '추가할 받는 분 정보가 없었어요.'
    );
    setFailures(fails);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/orders/gift/template"
          className="text-sm font-medium text-brand underline underline-offset-4 hover:text-brand-dark"
        >
          엑셀 양식 내려받기
        </a>
        <span aria-hidden className="text-hairline">
          |
        </span>
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={remainingSlots <= 0}
        >
          엑셀 파일 올리기
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = ''; // 같은 파일 재선택 허용
          }}
        />
      </div>

      <p className="text-sm text-muted">
        양식을 내려받아 받는 분 명단을 채운 뒤 올리면 아래 목록에 자동으로
        추가됩니다. 상품옵션은 구성 이름(예: 선물세트 5kg)으로 적어 주세요.
      </p>

      {error && (
        <p className="rounded-xl bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {summary && (
        <p className="rounded-xl bg-surface px-4 py-3 text-sm font-medium text-ink">
          {summary}
        </p>
      )}

      {failures.length > 0 && (
        <div className="rounded-xl border border-hairline bg-white px-4 py-3">
          <p className="text-sm font-medium text-ink">확인이 필요한 행</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-danger">
            {failures.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
