"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DetailBlock } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import {
  BLOCK_TYPE_LABELS,
  MAX_BLOCKS,
  MAX_SPECS_ROWS,
  isValidBlockImageUrl,
  parseDetailBlocks,
} from "@/app/api/admin/products/detail-blocks";

/**
 * v2.1 카드뉴스형 상세페이지 블록 편집기.
 * - 블록 목록: 카드마다 타입 한글 라벨 + 위/아래 이동 + 삭제, 타입별 입력 필드
 * - "+ 블록 추가": 타입 선택(한글 라벨 + 한 줄 설명)
 * - 저장: blocks 배열 전체를 PATCH /api/admin/products/[id] 로 전송
 * - 저장 전 변경은 "저장되지 않은 변경" 안내로 표시
 */

type BlockType = DetailBlock["type"];

const BLOCK_TYPE_ORDER: BlockType[] = [
  "heading",
  "text",
  "image",
  "point",
  "badge",
  "specs",
  "notice",
];

const BLOCK_TYPE_DESCRIPTIONS: Record<BlockType, string> = {
  heading: "구역을 나누는 큰 제목을 넣습니다.",
  text: "소개 글(문단)을 넣습니다.",
  image: "사진 한 장을 크게 보여줍니다.",
  point: "장점을 번호와 함께 강조합니다. 번호는 자동으로 붙습니다.",
  badge: "인증·수상 내용을 배지로 보여줍니다.",
  specs: "중량·과수 같은 정보를 표로 정리합니다.",
  notice: "포장·배송 안내를 강조 상자로 보여줍니다.",
};

/** 편집 중간 상태 — 타입별 필드를 한 형태로 들고 있다가 저장 시 블록으로 변환 */
interface Draft {
  type: BlockType;
  label: string; // heading
  title: string; // heading/point/badge/specs/notice
  body: string; // text/point/badge/notice
  url: string; // image
  caption: string; // image
  imageUrl: string; // point/badge (선택)
  rows: { k: string; v: string }[]; // specs
}

interface DraftItem {
  key: number;
  draft: Draft;
}

function emptyDraft(type: BlockType): Draft {
  return {
    type,
    label: "",
    title: "",
    body: "",
    url: "",
    caption: "",
    imageUrl: "",
    rows: type === "specs" ? [{ k: "", v: "" }] : [],
  };
}

function toDraft(block: DetailBlock): Draft {
  const draft = emptyDraft(block.type);
  switch (block.type) {
    case "heading":
      draft.label = block.label ?? "";
      draft.title = block.title;
      break;
    case "text":
      draft.body = block.body;
      break;
    case "image":
      draft.url = block.url;
      draft.caption = block.caption ?? "";
      break;
    case "point":
    case "badge":
      draft.title = block.title;
      draft.body = block.body;
      draft.imageUrl = block.imageUrl ?? "";
      break;
    case "specs":
      draft.title = block.title ?? "";
      draft.rows = block.rows.map((row) => ({ ...row }));
      break;
    case "notice":
      draft.title = block.title;
      draft.body = block.body;
      break;
  }
  return draft;
}

/** 저장용 원본 객체 — 검증/trim/빈 선택 필드 제거는 parseDetailBlocks 가 담당 */
function toRaw(draft: Draft): Record<string, unknown> {
  switch (draft.type) {
    case "heading":
      return { type: draft.type, label: draft.label, title: draft.title };
    case "text":
      return { type: draft.type, body: draft.body };
    case "image":
      return { type: draft.type, url: draft.url, caption: draft.caption };
    case "point":
    case "badge":
      return {
        type: draft.type,
        title: draft.title,
        body: draft.body,
        imageUrl: draft.imageUrl,
      };
    case "specs":
      return { type: draft.type, title: draft.title, rows: draft.rows };
    case "notice":
      return { type: draft.type, title: draft.title, body: draft.body };
  }
}

/** 사진 주소 미리보기 — url 이 바뀌면 key 로 리셋해서 다시 시도 */
function ImagePreview({ url }: { url: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      {broken ? (
        <p className="px-4 py-5 text-center text-base font-bold text-danger">
          이 주소로는 사진을 불러올 수 없습니다. 주소를 다시 확인해 주세요.
        </p>
      ) : (
        // 임의 주소의 외부 이미지라 next/image 대신 일반 img로 미리보기
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="사진 미리보기"
          loading="lazy"
          onError={() => setBroken(true)}
          className="max-h-56 w-full object-cover"
        />
      )}
    </div>
  );
}

function imageUrlError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "" || isValidBlockImageUrl(trimmed)) return undefined;
  return "사진 주소는 https:// 로 시작해야 합니다.";
}

export default function DetailBlocksEditor({
  productId,
  initialBlocks,
}: {
  productId: string;
  initialBlocks: DetailBlock[];
}) {
  const router = useRouter();
  // 초기 블록은 index 를 key 로, 이후 추가분은 keyRef 로 고유 key 부여
  const keyRef = useRef(initialBlocks.length);
  const [items, setItems] = useState<DraftItem[]>(() =>
    initialBlocks.map((block, index) => ({ key: index, draft: toDraft(block) }))
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  // 저장 안 한 변경이 있으면 창을 닫거나 이동할 때 브라우저 확인창 표시
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // beforeunload 는 앱 내 링크 이동(next/link — '< 상품 목록', 관리자 메뉴 등)에는
  // 발생하지 않는다. dirty 상태에서는 문서 레벨 클릭 캡처로 링크 클릭을 가로채
  // 확인창을 거친다. preventDefault 하면 next/link 도 이동을 중단한다.
  useEffect(() => {
    if (!dirty) return;
    function confirmLeave(e: MouseEvent) {
      if (e.defaultPrevented) return;
      // 새 탭/창으로 여는 클릭은 현재 화면이 유지되므로 막지 않는다
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor) return;
      const anchorTarget = anchor.getAttribute("target");
      if (anchorTarget && anchorTarget !== "_self") return;
      const leave = window.confirm(
        "저장하지 않은 변경이 있습니다.\n이 화면을 벗어나면 고친 내용이 사라집니다. 그래도 이동할까요?"
      );
      if (!leave) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener("click", confirmLeave, true);
    return () => document.removeEventListener("click", confirmLeave, true);
  }, [dirty]);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (type === "success") {
      timerRef.current = setTimeout(() => setMessage(null), 4000);
    }
  }

  function markDirty() {
    setDirty(true);
    setMessage((prev) => (prev?.type === "success" ? null : prev));
  }

  function updateDraft(key: number, patch: Partial<Draft>) {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, draft: { ...item.draft, ...patch } } : item
      )
    );
    markDirty();
  }

  function updateRow(key: number, rowIndex: number, field: "k" | "v", value: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const rows = item.draft.rows.map((row, i) =>
          i === rowIndex ? { ...row, [field]: value } : row
        );
        return { ...item, draft: { ...item.draft, rows } };
      })
    );
    markDirty();
  }

  function addRow(key: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key && item.draft.rows.length < MAX_SPECS_ROWS
          ? {
              ...item,
              draft: { ...item.draft, rows: [...item.draft.rows, { k: "", v: "" }] },
            }
          : item
      )
    );
    markDirty();
  }

  function removeRow(key: number, rowIndex: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key && item.draft.rows.length > 1
          ? {
              ...item,
              draft: {
                ...item.draft,
                rows: item.draft.rows.filter((_, i) => i !== rowIndex),
              },
            }
          : item
      )
    );
    markDirty();
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    setItems((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markDirty();
  }

  function removeBlock(index: number) {
    const item = items[index];
    if (!item) return;
    const label = BLOCK_TYPE_LABELS[item.draft.type];
    const confirmed = window.confirm(
      `${index + 1}번째 '${label}' 블록을 삭제할까요?\n'상세페이지 저장'을 누르기 전에는 손님 화면이 바뀌지 않습니다.`
    );
    if (!confirmed) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  }

  function addBlock(type: BlockType) {
    if (items.length >= MAX_BLOCKS) {
      showMessage("error", `블록은 최대 ${MAX_BLOCKS}개까지 만들 수 있습니다.`);
      setPickerOpen(false);
      return;
    }
    setItems((prev) => [...prev, { key: keyRef.current++, draft: emptyDraft(type) }]);
    setPickerOpen(false);
    markDirty();
    // 새 블록이 화면 아래에 생기므로 그 위치로 스크롤
    setTimeout(() => {
      listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  async function handleSave() {
    if (saving) return;
    const parsed = parseDetailBlocks(items.map((item) => toRaw(item.draft)));
    if (!parsed.ok) {
      showMessage("error", parsed.error);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: parsed.blocks }),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showMessage(
          "error",
          data?.error ?? "저장에 실패했습니다. 다시 시도해 주세요."
        );
        return;
      }
      setDirty(false);
      showMessage("success", "상세페이지가 저장되었습니다. 손님 화면에 반영됩니다.");
      router.refresh();
    } catch {
      showMessage("error", "연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-surface px-5 py-8 text-center">
          <p className="text-lg font-bold text-ink">아직 블록이 없습니다.</p>
          <p className="mt-1 text-base text-muted">
            지금은 위의 &lsquo;상세 소개&rsquo; 글이 손님에게 보입니다. 아래
            &lsquo;+ 블록 추가&rsquo;를 눌러 블록을 만들면 그 대신 블록이
            보입니다.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item, index) => (
            <li key={item.key}>
              <Card padding="sm">
                <div className="flex flex-col gap-3">
                  {/* 블록 헤더: 순번 + 타입 라벨 + 이동/삭제 */}
                  <div className="flex items-center justify-between gap-2 border-b border-hairline pb-3">
                    <p className="flex items-baseline gap-2">
                      <span className="text-base font-semibold tabular-nums text-muted">
                        {index + 1}
                      </span>
                      <span className="text-lg font-bold text-ink">
                        {BLOCK_TYPE_LABELS[item.draft.type]}
                      </span>
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        aria-label={`${index + 1}번째 블록 위로 이동`}
                        disabled={index === 0 || saving}
                        onClick={() => moveBlock(index, -1)}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-hairline bg-white text-xl font-bold text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`${index + 1}번째 블록 아래로 이동`}
                        disabled={index === items.length - 1 || saving}
                        onClick={() => moveBlock(index, 1)}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-hairline bg-white text-xl font-bold text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => removeBlock(index)}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-danger/30 bg-white px-4 text-base font-semibold text-danger transition-colors hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <BlockFields
                    draft={item.draft}
                    onChange={(patch) => updateDraft(item.key, patch)}
                    onRowChange={(rowIndex, field, value) =>
                      updateRow(item.key, rowIndex, field, value)
                    }
                    onRowAdd={() => addRow(item.key)}
                    onRowRemove={(rowIndex) => removeRow(item.key, rowIndex)}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <div ref={listEndRef} />

      {/* + 블록 추가 — 타입 선택 UI */}
      {pickerOpen ? (
        <Card padding="sm" className="border-brand/40">
          <p className="text-lg font-bold text-ink">어떤 블록을 추가할까요?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {BLOCK_TYPE_ORDER.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="flex min-h-14 cursor-pointer flex-col items-start gap-0.5 rounded-xl border border-hairline bg-white px-4 py-3 text-left transition-colors hover:border-brand hover:bg-brand/5"
              >
                <span className="text-lg font-bold text-ink">
                  {BLOCK_TYPE_LABELS[type]}
                </span>
                <span className="text-base text-muted">
                  {BLOCK_TYPE_DESCRIPTIONS[type]}
                </span>
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setPickerOpen(false)}
            className="mt-3 w-full text-lg"
          >
            취소
          </Button>
        </Card>
      ) : (
        <button
          type="button"
          disabled={saving || items.length >= MAX_BLOCKS}
          onClick={() => setPickerOpen(true)}
          className="flex min-h-14 w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed border-brand/40 bg-brand/5 px-4 text-lg font-bold text-brand-dark transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + 블록 추가
        </button>
      )}
      {items.length >= MAX_BLOCKS && (
        <p className="text-base text-muted">
          블록은 최대 {MAX_BLOCKS}개까지 만들 수 있습니다.
        </p>
      )}

      {/* 저장 영역 — 피드백 크게. 배너는 sticky 로 두어 긴 블록 목록을
          편집하는 중에도 화면 아래에 계속 보인다 */}
      {dirty && (
        <p
          role="status"
          className="sticky bottom-4 z-10 rounded-xl border border-hairline bg-surface px-4 py-3 text-lg font-bold text-ink shadow-sm"
        >
          저장되지 않은 변경이 있습니다. 아래 &lsquo;상세페이지 저장&rsquo;을
          눌러야 손님 화면에 반영됩니다.
        </p>
      )}
      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={
            message.type === "success"
              ? "text-lg font-bold text-brand-dark"
              : "text-lg font-bold text-danger"
          }
        >
          {message.type === "success" ? "✓ " : ""}
          {message.text}
        </p>
      )}
      <Button
        size="lg"
        disabled={saving}
        onClick={handleSave}
        className="w-full text-xl"
      >
        {saving ? "저장 중..." : "상세페이지 저장"}
      </Button>
    </div>
  );
}

/** 타입별 입력 필드 — 각 필드에 구체 예시 placeholder */
function BlockFields({
  draft,
  onChange,
  onRowChange,
  onRowAdd,
  onRowRemove,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onRowChange: (rowIndex: number, field: "k" | "v", value: string) => void;
  onRowAdd: () => void;
  onRowRemove: (rowIndex: number) => void;
}) {
  switch (draft.type) {
    case "heading":
      return (
        <div className="flex flex-col gap-3">
          <Input
            label="섹션 라벨 (선택)"
            value={draft.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="예: 임과일 나주배"
            hint="제목 위에 작게 나오는 짧은 말입니다. 비워 두어도 됩니다."
          />
          <Input
            label="제목"
            required
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="예: 나주에서 수확한 그대로"
            className="text-lg font-bold"
          />
        </div>
      );
    case "text":
      return (
        <Textarea
          label="내용"
          required
          value={draft.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={6}
          placeholder={
            "예: 나주는 일조량이 풍부하고 물빠짐이 좋은 토질을 갖춰 예로부터 배 산지로 알려져 있습니다."
          }
          hint="문단을 나누려면 빈 줄(엔터 두 번)로 구분해 주세요."
        />
      );
    case "image":
      return (
        <div className="flex flex-col gap-3">
          <Input
            label="사진 주소"
            required
            value={draft.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://..."
            inputMode="url"
            error={imageUrlError(draft.url)}
            hint="https:// 로 시작하는 사진 인터넷 주소를 붙여넣으세요."
          />
          {draft.url.trim() !== "" && !imageUrlError(draft.url) && (
            <ImagePreview key={draft.url.trim()} url={draft.url.trim()} />
          )}
          <Input
            label="사진 설명 (선택)"
            value={draft.caption}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="예: 수확 직후 선별 작업"
            hint="사진 아래에 작게 나오는 설명입니다. 비워 두어도 됩니다."
          />
        </div>
      );
    case "point":
    case "badge": {
      const isPoint = draft.type === "point";
      return (
        <div className="flex flex-col gap-3">
          {isPoint && (
            <p className="text-base text-muted">
              번호(01, 02...)는 포인트 순서대로 자동으로 붙습니다.
            </p>
          )}
          <Input
            label={isPoint ? "포인트 제목" : "배지 이름"}
            required
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder={isPoint ? "예: 산지 직송" : "예: GAP 인증"}
            className="text-lg font-bold"
          />
          <Textarea
            label="내용"
            required
            value={draft.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={4}
            placeholder={
              isPoint
                ? "예: 수확 시기의 당도를 확인한 뒤 발송합니다."
                : "예: 농산물우수관리(GAP) 인증을 받은 농장에서 재배합니다."
            }
          />
          <Input
            label="사진 주소 (선택)"
            value={draft.imageUrl}
            onChange={(e) => onChange({ imageUrl: e.target.value })}
            placeholder="https://..."
            inputMode="url"
            error={imageUrlError(draft.imageUrl)}
            hint="비워 두면 글만 보입니다."
          />
          {draft.imageUrl.trim() !== "" && !imageUrlError(draft.imageUrl) && (
            <ImagePreview
              key={draft.imageUrl.trim()}
              url={draft.imageUrl.trim()}
            />
          )}
        </div>
      );
    }
    case "specs":
      return (
        <div className="flex flex-col gap-3">
          <Input
            label="표 제목 (선택)"
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="예: 상품 구성"
          />
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 text-sm font-medium text-ink">
              <span className="flex-1">항목 이름</span>
              <span className="flex-1">내용</span>
              <span className="w-11 shrink-0" aria-hidden="true" />
            </div>
            {draft.rows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    label={`${rowIndex + 1}번째 행 항목 이름`}
                    labelHidden
                    value={row.k}
                    onChange={(e) => onRowChange(rowIndex, "k", e.target.value)}
                    placeholder="예: 가정용 3kg"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label={`${rowIndex + 1}번째 행 내용`}
                    labelHidden
                    value={row.v}
                    onChange={(e) => onRowChange(rowIndex, "v", e.target.value)}
                    placeholder="예: 7~9과 내외"
                  />
                </div>
                <button
                  type="button"
                  aria-label={`${rowIndex + 1}번째 행 삭제`}
                  disabled={draft.rows.length <= 1}
                  onClick={() => onRowRemove(rowIndex)}
                  className="inline-flex min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-danger/30 bg-white text-lg font-bold text-danger transition-colors hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              disabled={draft.rows.length >= MAX_SPECS_ROWS}
              onClick={onRowAdd}
              className="w-full text-base"
            >
              + 행 추가
            </Button>
            {draft.rows.length >= MAX_SPECS_ROWS && (
              <p className="text-sm text-muted">
                행은 최대 {MAX_SPECS_ROWS}개까지 만들 수 있습니다.
              </p>
            )}
          </div>
        </div>
      );
    case "notice":
      return (
        <div className="flex flex-col gap-3">
          <Input
            label="제목"
            required
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="예: 포장·배송 안내"
            className="text-lg font-bold"
          />
          <Textarea
            label="내용"
            required
            value={draft.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={4}
            placeholder="예: 주문 확인 후 수확해 완충 포장으로 보내드립니다. 농산물 특성상 크기와 모양은 조금씩 다를 수 있습니다."
          />
        </div>
      );
  }
}
