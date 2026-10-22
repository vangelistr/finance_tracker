import type { Slice } from '@/lib/aggregates';
import { formatMoney } from '@/lib/money';
import { DataTable, percentages } from './shared';

interface DonutProps {
  title: string;
  slices: Slice[];
  currency: string;
  locale: string;
  totalLabel: string;
  emptyLabel: string;
  head: [string, string, string];
}

const R = 42;
const C = 2 * Math.PI * R;

/** Ring chart drawn with stroke dashes; the legend carries the exact amounts and shares. */
export function Donut({ title, slices, currency, locale, totalLabel, emptyLabel, head }: DonutProps) {
  const total = slices.reduce((s, x) => s + x.valueMinor, 0);
  const pct = percentages(slices.map((s) => s.valueMinor));
  const gap = slices.length > 1 ? 1.2 : 0;
  let offset = 0;
  const summary = slices.map((s, i) => `${s.label} ${pct[i]}%`).join(', ');

  return (
    <figure className="m-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative mx-auto size-44 shrink-0 sm:mx-0">
        <svg viewBox="0 0 100 100" role="img" aria-label={total > 0 ? `${title}: ${summary}` : `${title}: ${emptyLabel}`} className="size-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
          {total > 0 &&
            slices.map((s) => {
              const len = (s.valueMinor / total) * C;
              const dash = Math.max(0, len - gap);
              const el = (
                <circle
                  key={s.key}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={`var(--chart-${s.color})`}
                  strokeWidth="11"
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-ink-3">{totalLabel}</span>
          <span className="num text-base font-semibold">{formatMoney(total, currency, locale)}</span>
        </div>
      </div>
      {total > 0 ? (
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
          {slices.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2.5">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--chart-${s.color})` }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="num text-ink-3">{pct[i]}%</span>
              <span className="num w-24 text-right font-medium">{formatMoney(s.valueMinor, currency, locale)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-2">{emptyLabel}</p>
      )}
      <DataTable caption={title} head={head} rows={slices.map((s, i) => [s.label, formatMoney(s.valueMinor, currency, locale), `${pct[i]}%`])} />
    </figure>
  );
}
