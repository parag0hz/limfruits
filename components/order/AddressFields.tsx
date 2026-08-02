'use client';

import { useState } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

/** 다음(카카오) 우편번호 서비스가 oncomplete로 넘겨주는 데이터 중 사용하는 필드 */
interface DaumPostcodeData {
  zonecode: string; // 우편번호 5자리
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: 'Y' | 'N';
  userSelectedType: 'R' | 'J';
}

interface DaumPostcode {
  open: () => void;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
      }) => DaumPostcode;
    };
  }
}

const POSTCODE_SCRIPT_URL =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

let scriptPromise: Promise<void> | null = null;

/** 우편번호 서비스 스크립트를 필요할 때 1회만 로드 */
function loadPostcodeScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.daum?.Postcode) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = POSTCODE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('postcode script load failed'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface AddressFieldsProps {
  postcode: string;
  address1: string;
  address2: string;
  onAddressSelect: (postcode: string, address1: string) => void;
  onAddress2Change: (value: string) => void;
  error?: string;
}

/** 배송지 입력: 주소검색 버튼(다음 우편번호) → 우편번호/기본주소 자동 입력, 상세주소는 직접 입력 */
export default function AddressFields({
  postcode,
  address1,
  address2,
  onAddressSelect,
  onAddress2Change,
  error,
}: AddressFieldsProps) {
  const [searching, setSearching] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const openSearch = async () => {
    setScriptError(null);
    setSearching(true);
    try {
      await loadPostcodeScript();
      if (!window.daum?.Postcode) {
        throw new Error('daum postcode unavailable');
      }
      new window.daum.Postcode({
        oncomplete: (data) => {
          const base =
            data.userSelectedType === 'R'
              ? data.roadAddress
              : data.jibunAddress;
          const withBuilding =
            data.userSelectedType === 'R' && data.buildingName
              ? `${base} (${data.buildingName})`
              : base;
          onAddressSelect(data.zonecode, withBuilding);
        },
      }).open();
    } catch {
      setScriptError(
        '주소검색 창을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="w-32 shrink-0">
          <Input
            label="우편번호"
            required
            value={postcode}
            readOnly
            placeholder="주소검색"
          />
        </div>
        <Button
          variant="outline"
          onClick={openSearch}
          disabled={searching}
          className="mb-0.5 shrink-0"
        >
          {searching ? '여는 중…' : '주소검색'}
        </Button>
      </div>
      <Input
        label="기본 주소"
        required
        value={address1}
        readOnly
        placeholder="주소검색 버튼을 눌러 주소를 선택해 주세요"
        error={error}
      />
      <Input
        label="상세 주소"
        value={address2}
        onChange={(e) => onAddress2Change(e.target.value)}
        placeholder="동/호수 등 상세 주소를 입력해 주세요"
        autoComplete="address-line2"
      />
      {scriptError && (
        <p className="text-sm font-medium text-danger">{scriptError}</p>
      )}
    </div>
  );
}
