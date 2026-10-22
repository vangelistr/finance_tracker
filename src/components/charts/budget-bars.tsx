import { AlertTriangle, OctagonAlert } from 'lucide-react';
import type { BudgetProgress } from '@/lib/aggregates';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

interface Props {
  items: BudgetProgress[];
  currency: string;
  locale: string;
  labels: { of: (spent: string, budget: string) => string; over: (amount: string) => string; left: (amount: string) => string; warning: string; overState: string };
}

/** One bar per budget: neutral fill while on track, amber with an icon from the first threshold, red when over. */
export function BudgetBars({ items, currency, locale, labels }: Props) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((b) => {
        const over = b.usedBps >= 10_000;
        const warn = !over && b.reached !== null;
        const width = Math.min(100, b.usedBps / 100);
        const remaining = b.budgetMinor - b.spentMinor;
        return (
          <li key={b.categoryId ?? 'overall'}>
            <div className="mb-1.5 flex items-baseline gap-3 text-sm">
              <span className={cn('min-w-0 flex-1 truncate', b.categoryId === null ? 'font-semibold' : 'font-medium')}>{b.label}</span>
              <span className="num text-ink-2">{labels.of(formatMoney(b.spentMinor, currency, locale), formatMoney(b.budgetMinor, currency, locale))}</span>
            </div>
            <div
              role="meter"
              aria-label={b.label}
              aria-valuemin={0}
              aria-valuemax={b.budgetMinor / 100}
              aria-valuenow={Math.min(b.spentMinor, b.budgetMinor) / 100}
              aria-valuetext={`${Math.round(b.usedBps / 100)}%`}
              className="h-2.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div className={cn('h-full rounded-full', over ? 'bg-danger' : warn ? 'bg-warning-fill' : 'bg-ink')} style={{ width: `${width}%` }} />
            </div>
            <p className={cn('mt-1 flex items-center gap-1.5 text-sm', over ? 'text-danger' : warn ? 'text-warning' : 'text-ink-3')}>
              {over && <OctagonAlert aria-hidden className="size-3.5" strokeWidth={2} />}
              {warn && <AlertTriangle aria-hidden className="size-3.5" strokeWidth={2} />}
              {over ? labels.over(formatMoney(-remaining, currency, locale)) : labels.left(formatMoney(remaining, currency, locale))}
              {(over || warn) && <span className="sr-only">{over ? labels.overState : labels.warning}</span>}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
