import type { DetailBlock } from '@/lib/types';

/**
 * v2.1 카드뉴스형 상세페이지 블록 렌더러 (server component).
 * - heading 블록을 경계로 섹션을 나누고 white/surface 배경을 교차한다.
 *   배경은 풀블리드, 콘텐츠는 중앙 컬럼(max-w-4xl) 안에 놓인다.
 * - point 는 렌더 순서대로 01, 02… 자동 번호. 이미지가 있으면 데스크톱에서
 *   이미지·텍스트를 좌우 교차 배치한다.
 * - 텍스트는 전부 React 텍스트 노드로만 렌더한다 (dangerouslySetInnerHTML 금지).
 */

type Tone = 'white' | 'surface';

interface SectionItem {
  block: DetailBlock;
  /** point 블록의 자동 번호 (1부터, 전체 blocks 기준 연속) */
  pointNo?: number;
  /** 이미지 있는 point 의 데스크톱 이미지 위치 (이미지 point 순서대로 교차) */
  imageSide?: 'left' | 'right';
}

interface Section {
  tone: Tone;
  items: SectionItem[];
}

/**
 * url 이 https:// 또는 단일 슬래시(/)로 시작할 때만 렌더한다.
 * javascript: 등 위험 스킴과 프로토콜 상대 URL(//host)을 함께 차단.
 */
function isSafeUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (url.startsWith('https://')) return true;
  return url.startsWith('/') && !url.startsWith('//');
}

/** 빈 줄 기준 문단 분리 */
function toParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** heading 을 경계로 섹션을 묶고 tone·point 번호를 미리 계산한다 */
function buildSections(blocks: DetailBlock[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let pointNo = 0;
  let imagePointCount = 0;

  for (const block of blocks) {
    if (block.type === 'heading' || !current) {
      current = {
        tone: sections.length % 2 === 0 ? 'white' : 'surface',
        items: [],
      };
      sections.push(current);
    }
    const item: SectionItem = { block };
    if (block.type === 'point') {
      item.pointNo = ++pointNo;
      if (isSafeUrl(block.imageUrl)) {
        item.imageSide = imagePointCount % 2 === 0 ? 'left' : 'right';
        imagePointCount += 1;
      }
    }
    current.items.push(item);
  }
  return sections;
}

/** 섹션 배경 위에서 대비가 살도록 pill·박스 배경은 tone 반대색을 쓴다 */
const CONTRAST_BG: Record<Tone, string> = {
  white: 'bg-surface',
  surface: 'bg-white',
};

function HeadingBlock({
  block,
  tone,
}: {
  block: Extract<DetailBlock, { type: 'heading' }>;
  tone: Tone;
}) {
  return (
    <div className="text-center">
      {block.label && (
        <span
          className={`inline-block rounded-full px-3.5 py-1.5 text-xs font-medium text-muted sm:text-sm ${CONTRAST_BG[tone]}`}
        >
          {block.label}
        </span>
      )}
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl">
        {block.title}
      </h2>
    </div>
  );
}

function TextBlock({ block }: { block: Extract<DetailBlock, { type: 'text' }> }) {
  return (
    <div className="mx-auto flex max-w-prose flex-col gap-4 text-center">
      {toParagraphs(block.body).map((p, i) => (
        <p key={i} className="text-base leading-8 text-ink/85">
          {p}
        </p>
      ))}
    </div>
  );
}

function ImageBlock({
  block,
}: {
  block: Extract<DetailBlock, { type: 'image' }>;
}) {
  if (!isSafeUrl(block.url)) return null;
  return (
    <figure className="w-full">
      {/* 관리자가 입력하는 임의 도메인 URL — next/image 대신 img + lazy */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.url}
        alt={block.caption ?? '상품 상세 이미지'}
        loading="lazy"
        className="w-full rounded-2xl"
      />
      {block.caption && (
        <figcaption className="mt-3 text-center text-sm text-muted">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

function PointBlock({
  block,
  pointNo,
  imageSide,
}: {
  block: Extract<DetailBlock, { type: 'point' }>;
  pointNo: number;
  imageSide?: 'left' | 'right';
}) {
  const no = String(pointNo).padStart(2, '0');
  const body = toParagraphs(block.body);

  if (!imageSide) {
    return (
      <div className="mx-auto max-w-prose text-center">
        <p className="font-mono text-sm font-semibold tracking-widest text-brand">
          {no}
        </p>
        <h3 className="mt-3 text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {block.title}
        </h3>
        <div className="mt-4 flex flex-col gap-4">
          {body.map((p, i) => (
            <p key={i} className="text-base leading-8 text-ink/85">
              {p}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full items-center gap-6 md:grid-cols-2 md:gap-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.imageUrl}
        alt={block.title}
        loading="lazy"
        className={`aspect-[4/3] w-full rounded-2xl object-cover ${
          imageSide === 'right' ? 'md:order-2' : ''
        }`}
      />
      <div className={imageSide === 'right' ? 'md:order-1' : ''}>
        <p className="font-mono text-sm font-semibold tracking-widest text-brand">
          {no}
        </p>
        <h3 className="mt-3 text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {block.title}
        </h3>
        <div className="mt-4 flex flex-col gap-4">
          {body.map((p, i) => (
            <p key={i} className="text-base leading-8 text-ink/85">
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function BadgeBlock({
  block,
  tone,
}: {
  block: Extract<DetailBlock, { type: 'badge' }>;
  tone: Tone;
}) {
  return (
    <div
      className={`mx-auto flex w-full max-w-2xl items-center gap-5 rounded-2xl p-5 sm:p-6 ${CONTRAST_BG[tone]}`}
    >
      {isSafeUrl(block.imageUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.imageUrl}
          alt={block.title}
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand/10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-brand"
          >
            <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 8.7l5.4-.8z" />
          </svg>
        </span>
      )}
      <div className="min-w-0">
        <p className="font-bold text-ink">{block.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{block.body}</p>
      </div>
    </div>
  );
}

function SpecsBlock({
  block,
}: {
  block: Extract<DetailBlock, { type: 'specs' }>;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      {block.title && (
        <h3 className="text-center text-lg font-bold tracking-tight text-ink sm:text-xl">
          {block.title}
        </h3>
      )}
      <dl
        className={`divide-y divide-hairline border-y border-hairline ${
          block.title ? 'mt-6' : ''
        }`}
      >
        {block.rows.map((row, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4 py-3.5">
            <dt className="text-base text-muted">{row.k}</dt>
            <dd className="text-right text-base font-medium tabular-nums text-ink">
              {row.v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function NoticeBlock({
  block,
  tone,
}: {
  block: Extract<DetailBlock, { type: 'notice' }>;
  tone: Tone;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-2xl rounded-2xl p-6 sm:p-8 ${CONTRAST_BG[tone]}`}
    >
      <h3 className="font-bold text-ink">{block.title}</h3>
      <div className="mt-2 flex flex-col gap-3">
        {toParagraphs(block.body).map((p, i) => (
          <p key={i} className="text-base leading-7 text-ink/85">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}

function SectionItemView({ item, tone }: { item: SectionItem; tone: Tone }) {
  const { block } = item;
  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} tone={tone} />;
    case 'text':
      return <TextBlock block={block} />;
    case 'image':
      return <ImageBlock block={block} />;
    case 'point':
      return (
        <PointBlock
          block={block}
          pointNo={item.pointNo ?? 1}
          imageSide={item.imageSide}
        />
      );
    case 'badge':
      return <BadgeBlock block={block} tone={tone} />;
    case 'specs':
      return <SpecsBlock block={block} />;
    case 'notice':
      return <NoticeBlock block={block} tone={tone} />;
    default:
      return null;
  }
}

/**
 * 상품 상세 카드뉴스 블록 목록.
 * blocks 가 비어 있으면 아무것도 렌더하지 않는다 (페이지에서 detail 폴백 처리).
 */
export default function DetailBlocks({ blocks }: { blocks: DetailBlock[] }) {
  if (blocks.length === 0) return null;
  const sections = buildSections(blocks);

  return (
    <div>
      {sections.map((section, i) => (
        <section
          key={i}
          className={section.tone === 'surface' ? 'bg-surface' : 'bg-white'}
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-16 sm:gap-16 sm:px-6 sm:py-20">
            {section.items.map((item, j) => (
              <SectionItemView key={j} item={item} tone={section.tone} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
