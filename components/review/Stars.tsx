import { cn } from '@/components/ui/cn';

/** 별 도형 path (24x24) — 리뷰 표시·별점 피커에서 공용 */
export const STAR_PATH =
  'M12 2.6l2.83 5.93 6.42.84-4.72 4.5 1.2 6.42L12 17.16l-5.73 3.13 1.2-6.42-4.72-4.5 6.42-.84L12 2.6z';

export interface StarsProps {
  /** 0~5. 소수는 반올림해서 채움 */
  rating: number;
  size?: 'sm' | 'md';
  className?: string;
}

/** 별점 표시 (읽기 전용) — 채운 별은 brand, 빈 별은 hairline */
export default function Stars({ rating, size = 'md', className }: StarsProps) {
  const filled = Math.round(rating);
  // 평균값(예: 4.333…)이 그대로 읽히지 않도록 라벨은 소수 첫째 자리까지만
  const labelRating = Math.round(rating * 10) / 10;
  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span
      role="img"
      aria-label={`별점 5점 중 ${labelRating}점`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="currentColor"
          className={cn(starSize, n <= filled ? 'text-brand' : 'text-hairline')}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

export { Stars };
