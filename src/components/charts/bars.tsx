import type { MonthBar } from '@/lib/aggregates';
import { formatMoney } from '@/lib/money';
import { DataTable, niceMax } from './shared';

interface BarsProps {
  title: string;
  bars: MonthBar[];
  currency: string;
  locale: string;
  labels: { in: string; out: string; month: string };
  monthLabel: (month: string) => string;
}

/** Income (green) and spending (red) side by side per month, on one shared scale. */
export function IncomeExpenseBars({ title, bars, currency, locale, labels, monthLabel }: BarsProps) {
  const max = niceMax(Math.max(1, ...bars.flatMap((b) => [b.inMinor, b.outMinor])));
  const W = 600;
  const H = 200;
  const PAD_L = 0;
  const PAD_B = 22;
  const plotH = H - PAD_B - 8;
  const group = (W - PAD_L) / bars.length;
  const barW = Math.min(22, group * 0.32);
  const y = (v: number) => 8 + plotH - (v / max) * plotH;
  const summary = bars.map((b) => `${monthLabel(b.month)}: ${labels.in} ${formatMoney(b.inMinor, currency, locale)}, ${labels.out} ${formatMoney(b.outMinor, currency, locale)}`).join('; ');

  return (
    <figure className="m-0">
      <div className="mb-3 flex gap-4 text-sm text-ink-2">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-4 rounded-sm bg-income" /> {labels.in}
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-4 rounded-sm bg-spend" /> {labels.out}
        </span>
        <span className="num ml-auto text-ink-3">{formatMoney(max, currency, locale)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${summary}`} className="block h-52 w-full" preserveAspectRatio="none">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--rule)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {bars.map((b, i) => {
          const cx = PAD_L + group * i + group / 2;
          return (
            <g key={b.month}>
              <rect x={cx - barW - 1.5} y={y(b.inMinor)} width={barW} height={Math.max(0, y(0) - y(b.inMinor))} rx={2} fill="var(--income)" />
              <rect x={cx + 1.5} y={y(b.outMinor)} width={barW} height={Math.max(0, y(0) - y(b.outMinor))} rx={2} fill="var(--spend)" />
            </g>
          );
        })}
      </svg>
      <div className="grid text-center text-xs text-ink-3 capitalize" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
        {bars.map((b) => (
          <span key={b.month} className="truncate">
            {monthLabel(b.month)}
          </span>
        ))}
      </div>
      <DataTable
        caption={title}
        head={[labels.month, labels.in, labels.out]}
        rows={bars.map((b) => [monthLabel(b.month), formatMoney(b.inMinor, currency, locale), formatMoney(b.outMinor, currency, locale)])}
      />
    </figure>
  );
}
