import type { Point } from '@/lib/aggregates';
import { formatMoney } from '@/lib/money';
import { DataTable } from './shared';

interface LineProps {
  title: string;
  points: Point[];
  currency: string;
  locale: string;
  labels: { month: string; value: string };
  monthLabel: (month: string) => string;
}

/** Net worth at each month end; the latest value is labelled, the rest are in the table. */
export function NetWorthLine({ title, points, currency, locale, labels, monthLabel }: LineProps) {
  const W = 600;
  const H = 180;
  const values = points.map((p) => p.valueMinor);
  const lo = Math.min(0, ...values);
  const hi = Math.max(1, ...values);
  const span = hi - lo || 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * (W - 12) + 6);
  const y = (v: number) => 10 + (H - 20) * (1 - (v - lo) / span);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valueMinor).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${path} L${x(points.length - 1).toFixed(1)},${y(lo)} L${x(0).toFixed(1)},${y(lo)} Z` : '';
  const last = points.at(-1);

  return (
    <figure className="m-0">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="text-sm text-ink-2 capitalize">{last ? monthLabel(last.month) : ''}</span>
        <span className="num text-xl font-semibold">{last ? formatMoney(last.valueMinor, currency, locale) : ''}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${points.map((p) => `${monthLabel(p.month)} ${formatMoney(p.valueMinor, currency, locale)}`).join('; ')}`}
        className="block h-44 w-full"
        preserveAspectRatio="none"
      >
        {lo < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--rule-strong)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
        {area && <path d={area} fill="var(--accent-soft)" opacity={0.6} />}
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {last && (
        // The latest value as a station; HTML so it stays round in the stretched SVG.
        <div aria-hidden className="relative -mt-44 h-44">
          <span
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-surface"
            style={{ left: `${(x(points.length - 1) / W) * 100}%`, top: `${(y(last.valueMinor) / H) * 100}%` }}
          />
        </div>
      )}
      <div className="mt-1 flex justify-between text-xs text-ink-3 capitalize">
        <span>{points[0] ? monthLabel(points[0].month) : ''}</span>
        <span>{last ? monthLabel(last.month) : ''}</span>
      </div>
      <DataTable caption={title} head={[labels.month, labels.value]} rows={points.map((p) => [monthLabel(p.month), formatMoney(p.valueMinor, currency, locale)])} />
    </figure>
  );
}
