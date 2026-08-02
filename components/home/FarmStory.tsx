import SectionTitle from "@/components/ui/SectionTitle";

const FEATURES = [
  {
    title: "아삭한 식감",
    body: "한 입 베어 물면 시원하게 아삭, 나주배 특유의 씹는 맛이 살아 있습니다.",
  },
  {
    title: "풍부한 과즙",
    body: "입안 가득 퍼지는 맑고 시원한 과즙. 갈증 날 때 물 대신 드셔도 좋아요.",
  },
  {
    title: "높은 당도",
    body: "볕 좋은 나주 들녘에서 충분히 익혀 수확해 달콤함이 진합니다.",
  },
];

/** 실사진이 들어갈 자리 — 명확한 placeholder (PLACEHOLDERS.md 참고) */
function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/50 bg-brand-light/60 p-4 text-center">
      <span
        aria-hidden
        className="block h-4 w-8 rounded-t-full border-[3px] border-b-0 border-brand/50"
      />
      <p className="text-sm font-bold text-brand-dark/80">사진 준비 중</p>
      <p className="text-xs text-ink/55">{label}</p>
    </div>
  );
}

/**
 * 농장 소개 — 임과일 이야기.
 * 확인되지 않은 사실(N대째, 수상 이력 등)은 쓰지 않는다.
 */
export default function FarmStory() {
  return (
    <section id="story" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
      <SectionTitle
        align="center"
        sub="나주에서 배 농사를 짓는 가족의 작은 과수원입니다"
      >
        임과일 이야기
      </SectionTitle>

      <div className="mt-8 grid gap-8 md:grid-cols-[3fr_2fr] md:items-start">
        <div className="space-y-4 text-base leading-relaxed text-ink/85 sm:text-lg">
          <p>
            임과일은 예로부터 배 재배로 이름난 전남 나주에서 부모님이 직접 배
            농사를 짓는 가족 과수원입니다. 봄에 꽃을 솎고, 여름내 한 알 한 알
            봉지를 씌우고, 가을에 잘 익은 배만 골라 수확하기까지 — 한 해의
            정성을 그대로 담아 보내드립니다.
          </p>
          <p>
            중간 유통을 거치지 않고 산지에서 바로 포장해 발송하기 때문에, 갓
            수확한 배의 아삭한 식감과 풍부한 과즙을 그대로 받아보실 수 있어요.
            가족이 먹는 과일을 고르는 마음으로, 하나하나 살펴 담겠습니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <PhotoPlaceholder label="농장 전경 사진이 들어갈 자리입니다" />
          <PhotoPlaceholder label="배 수확 모습 사진이 들어갈 자리입니다" />
        </div>
      </div>

      <ul className="mt-10 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {FEATURES.map((f) => (
          <li
            key={f.title}
            className="rounded-2xl border-2 border-brand bg-white p-5"
          >
            <span
              aria-hidden
              className="block h-3.5 w-7 rounded-t-full border-[3px] border-b-0 border-accent-yellow"
            />
            <h3 className="mt-2.5 font-heading text-xl text-brand-dark">
              {f.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/75">{f.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { FarmStory };
