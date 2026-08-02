import type { OrderStatus } from '@/lib/types';
import { cn } from '@/components/ui/cn';

const STEPS: { label: string; reached: OrderStatus[] }[] = [
  { label: '결제완료', reached: ['PAID', 'SHIPPING', 'DONE'] },
  { label: '배송중', reached: ['SHIPPING', 'DONE'] },
  { label: '배송완료', reached: ['DONE'] },
];

/**
 * 주문 상태 타임라인: 결제완료 → 배송중 → 배송완료.
 * PENDING/CANCELED는 호출부에서 별도 안내를 보여주고 이 컴포넌트는 쓰지 않아도 된다.
 */
export default function OrderStatusTimeline({
  status,
}: {
  status: OrderStatus;
}) {
  return (
    <ol className="flex items-center" aria-label="주문 진행 상태">
      {STEPS.map((step, i) => {
        const active = step.reached.includes(status);
        const current =
          active &&
          (i === STEPS.length - 1 || !STEPS[i + 1].reached.includes(status));
        return (
          <li key={step.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold',
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-ink/20 bg-white text-ink/40'
                )}
                aria-hidden="true"
              >
                {active ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4.5 w-4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4.5 12.5l5 5 10-11" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  'text-sm whitespace-nowrap',
                  current
                    ? 'font-bold text-brand-dark'
                    : active
                      ? 'font-medium text-brand-dark/70'
                      : 'text-ink/40'
                )}
              >
                {step.label}
                {current && <span className="sr-only"> (현재 상태)</span>}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'mx-2 mb-6 h-0.5 flex-1 rounded-full',
                  STEPS[i + 1].reached.includes(status)
                    ? 'bg-brand'
                    : 'bg-ink/15'
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
