import type { DetailBlock } from "@/lib/types";

/**
 * v2.1 카드뉴스형 상세페이지 블록 검증 (SPEC v2.1 부록 "API·검증" 절).
 * - 배열 최대 60개, 블록 type 화이트리스트, 필수 필드 존재
 * - 문자열 길이 상한: 제목류 200자 / 본문 5000자 / url 1000자
 * - 이미지 url 은 https:// 또는 / 시작만 허용 (javascript: 등 차단)
 * - specs rows 최대 30개
 *
 * 서버(PATCH /api/admin/products/[id])와 관리자 편집 화면이 같은 함수를 사용해
 * 규칙이 어긋나지 않게 한다. 검증 통과 시 알 수 없는 필드를 제거하고
 * trim 한 "깨끗한" 블록 배열을 돌려준다.
 */

export const MAX_BLOCKS = 60;
export const MAX_SPECS_ROWS = 30;
export const MAX_TITLE_LEN = 200; // 제목·라벨·캡션·표 항목 등 짧은 글
export const MAX_BODY_LEN = 5000; // 본문
export const MAX_URL_LEN = 1000;

/** 블록 타입별 한글 라벨 (관리자 화면·오류 메시지 공용) */
export const BLOCK_TYPE_LABELS: Record<DetailBlock["type"], string> = {
  heading: "제목",
  text: "문단",
  image: "사진",
  point: "포인트",
  badge: "인증 배지",
  specs: "규격 표",
  notice: "안내 박스",
};

const BLOCK_TYPES = Object.keys(BLOCK_TYPE_LABELS) as DetailBlock["type"][];

export type ParseBlocksResult =
  | { ok: true; blocks: DetailBlock[] }
  | { ok: false; error: string };

/**
 * 상세페이지 이미지 주소 규칙 — 렌더러(DetailBlocks 의 isSafeUrl)와 동일하게
 * 소문자 https:// 또는 단일 슬래시(/) 시작만 허용한다.
 * 프로토콜 상대 URL(//host)·대문자 스킴은 렌더러가 거부하므로 저장 단계에서 함께 막아
 * "저장은 됐는데 손님 화면에는 안 보이는" 무음 실패를 방지한다.
 */
export function isValidBlockImageUrl(url: string): boolean {
  return (
    url.startsWith("https://") ||
    (url.startsWith("/") && !url.startsWith("//"))
  );
}

type FieldCheck =
  | { ok: true; value: string }
  | { ok: false; error: string };

function checkText(
  value: unknown,
  fieldLabel: string,
  maxLen: number,
  required: boolean
): FieldCheck {
  if (value === undefined || value === null) {
    if (required) {
      return { ok: false, error: `'${fieldLabel}' 칸을 채워 주세요.` };
    }
    return { ok: true, value: "" };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `'${fieldLabel}' 값이 올바르지 않습니다.` };
  }
  const trimmed = value.trim();
  if (required && trimmed === "") {
    return { ok: false, error: `'${fieldLabel}' 칸을 채워 주세요.` };
  }
  if (trimmed.length > maxLen) {
    return {
      ok: false,
      error: `'${fieldLabel}' 내용이 너무 깁니다. ${maxLen}자 이내로 줄여 주세요.`,
    };
  }
  return { ok: true, value: trimmed };
}

function checkImageUrl(
  value: unknown,
  fieldLabel: string,
  required: boolean
): FieldCheck {
  const text = checkText(value, fieldLabel, MAX_URL_LEN, required);
  if (!text.ok) return text;
  if (text.value !== "" && !isValidBlockImageUrl(text.value)) {
    return {
      ok: false,
      error: `'${fieldLabel}' 칸에는 https:// 로 시작하는 인터넷 주소를 넣어 주세요.`,
    };
  }
  return text;
}

/**
 * blocks 배열 전체를 검증한다.
 * 실패 시 몇 번째 블록이 왜 틀렸는지 한국어 메시지로 알려준다.
 */
export function parseDetailBlocks(value: unknown): ParseBlocksResult {
  if (!Array.isArray(value)) {
    return { ok: false, error: "상세페이지 블록 형식이 올바르지 않습니다." };
  }
  if (value.length > MAX_BLOCKS) {
    return {
      ok: false,
      error: `블록은 최대 ${MAX_BLOCKS}개까지 저장할 수 있습니다. (지금 ${value.length}개)`,
    };
  }

  const blocks: DetailBlock[] = [];

  for (let i = 0; i < value.length; i++) {
    const raw = value[i];
    const at = `${i + 1}번째 블록`;

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { ok: false, error: `${at}: 형식이 올바르지 않습니다.` };
    }
    const block = raw as Record<string, unknown>;
    const type = block.type;
    if (
      typeof type !== "string" ||
      !BLOCK_TYPES.includes(type as DetailBlock["type"])
    ) {
      return {
        ok: false,
        error: `${at}: 알 수 없는 블록 종류입니다. (제목/문단/사진/포인트/인증 배지/규격 표/안내 박스만 가능)`,
      };
    }
    const label = BLOCK_TYPE_LABELS[type as DetailBlock["type"]];
    const where = `${at}(${label})`;

    switch (type as DetailBlock["type"]) {
      case "heading": {
        const labelField = checkText(
          block.label,
          "섹션 라벨",
          MAX_TITLE_LEN,
          false
        );
        if (!labelField.ok) {
          return { ok: false, error: `${where}: ${labelField.error}` };
        }
        const title = checkText(block.title, "제목", MAX_TITLE_LEN, true);
        if (!title.ok) return { ok: false, error: `${where}: ${title.error}` };
        blocks.push(
          labelField.value === ""
            ? { type: "heading", title: title.value }
            : { type: "heading", label: labelField.value, title: title.value }
        );
        break;
      }
      case "text": {
        const body = checkText(block.body, "내용", MAX_BODY_LEN, true);
        if (!body.ok) return { ok: false, error: `${where}: ${body.error}` };
        blocks.push({ type: "text", body: body.value });
        break;
      }
      case "image": {
        const url = checkImageUrl(block.url, "사진 주소", true);
        if (!url.ok) return { ok: false, error: `${where}: ${url.error}` };
        const caption = checkText(
          block.caption,
          "사진 설명",
          MAX_TITLE_LEN,
          false
        );
        if (!caption.ok) {
          return { ok: false, error: `${where}: ${caption.error}` };
        }
        blocks.push(
          caption.value === ""
            ? { type: "image", url: url.value }
            : { type: "image", url: url.value, caption: caption.value }
        );
        break;
      }
      case "point":
      case "badge": {
        const title = checkText(block.title, "제목", MAX_TITLE_LEN, true);
        if (!title.ok) return { ok: false, error: `${where}: ${title.error}` };
        const body = checkText(block.body, "내용", MAX_BODY_LEN, true);
        if (!body.ok) return { ok: false, error: `${where}: ${body.error}` };
        const imageUrl = checkImageUrl(block.imageUrl, "사진 주소", false);
        if (!imageUrl.ok) {
          return { ok: false, error: `${where}: ${imageUrl.error}` };
        }
        const base = {
          type: type as "point" | "badge",
          title: title.value,
          body: body.value,
        };
        blocks.push(
          imageUrl.value === "" ? base : { ...base, imageUrl: imageUrl.value }
        );
        break;
      }
      case "specs": {
        const title = checkText(block.title, "표 제목", MAX_TITLE_LEN, false);
        if (!title.ok) return { ok: false, error: `${where}: ${title.error}` };
        const rawRows = block.rows;
        if (!Array.isArray(rawRows)) {
          return { ok: false, error: `${where}: 표 형식이 올바르지 않습니다.` };
        }
        if (rawRows.length === 0) {
          return {
            ok: false,
            error: `${where}: 표에 행을 1개 이상 추가해 주세요.`,
          };
        }
        if (rawRows.length > MAX_SPECS_ROWS) {
          return {
            ok: false,
            error: `${where}: 표 행은 최대 ${MAX_SPECS_ROWS}개까지 가능합니다. (지금 ${rawRows.length}개)`,
          };
        }
        const rows: { k: string; v: string }[] = [];
        for (let r = 0; r < rawRows.length; r++) {
          const rawRow = rawRows[r];
          if (
            typeof rawRow !== "object" ||
            rawRow === null ||
            Array.isArray(rawRow)
          ) {
            return {
              ok: false,
              error: `${where}: ${r + 1}번째 행 형식이 올바르지 않습니다.`,
            };
          }
          const row = rawRow as Record<string, unknown>;
          const k = checkText(
            row.k,
            `${r + 1}번째 행 항목 이름`,
            MAX_TITLE_LEN,
            true
          );
          if (!k.ok) return { ok: false, error: `${where}: ${k.error}` };
          const v = checkText(
            row.v,
            `${r + 1}번째 행 내용`,
            MAX_TITLE_LEN,
            true
          );
          if (!v.ok) return { ok: false, error: `${where}: ${v.error}` };
          rows.push({ k: k.value, v: v.value });
        }
        blocks.push(
          title.value === ""
            ? { type: "specs", rows }
            : { type: "specs", title: title.value, rows }
        );
        break;
      }
      case "notice": {
        const title = checkText(block.title, "제목", MAX_TITLE_LEN, true);
        if (!title.ok) return { ok: false, error: `${where}: ${title.error}` };
        const body = checkText(block.body, "내용", MAX_BODY_LEN, true);
        if (!body.ok) return { ok: false, error: `${where}: ${body.error}` };
        blocks.push({ type: "notice", title: title.value, body: body.value });
        break;
      }
    }
  }

  return { ok: true, blocks };
}

/**
 * 검증을 거치지 않았을 수 있는 저장 데이터(예: Supabase 대시보드에서 직접 수정한
 * jsonb)를 읽을 때 쓰는 정화 함수. 형식이 어긋난 블록만 조용히 버리고 나머지는
 * 유지한다 — 블록 하나 때문에 상세 화면·관리자 편집기가 통째로 죽는 것 방지.
 */
export function sanitizeDetailBlocks(value: unknown): DetailBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: DetailBlock[] = [];
  for (const raw of value.slice(0, MAX_BLOCKS)) {
    const parsed = parseDetailBlocks([raw]);
    if (parsed.ok) blocks.push(...parsed.blocks);
  }
  return blocks;
}
