import { cn } from '@/lib/cn';

export type MarkTone = 'income' | 'expense' | 'renewal' | 'transfer' | 'goal';

const TONE: Record<MarkTone, string> = {
  income: 'var(--income)',
  expense: 'var(--spend)',
  renewal: 'var(--accent)',
  transfer: 'var(--ink-3)',
  goal: 'var(--goal-fill)',
};

/** A station: hollow ring while expected or projected, filled once done. Dashed for projections. Always paired with text. */
export function StatusMark({ tone, state, className }: { tone: MarkTone; state: 'expected' | 'done' | 'projected' | 'skipped'; className?: string }) {
  const colour = TONE[tone];
  return (
    <span
      aria-hidden
      className={cn('inline-block size-3 shrink-0 rounded-full border-[2.5px]', state === 'projected' && 'border-dashed', state === 'skipped' && 'opacity-40', className)}
      style={{ borderColor: colour, background: state === 'done' ? colour : 'var(--surface)' }}
    />
  );
}
