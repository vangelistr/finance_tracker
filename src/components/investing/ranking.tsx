import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Money } from '@/components/data/money';
import { Section } from '@/components/shell/page-header';
import { EXCHANGE_INFO } from '@/lib/investing/instruments';
import { METRICS, type Metric } from '@/lib/investing/metrics';
import type { Weights } from '@/lib/investing/ranking';
import { formatDay, intlLocale } from '@/lib/intl';
import type { InsightRow } from '@/server/services/investing';
import { formatBp, formatPct, formatPrice, formatScore } from './format';

// The daily ranking (PLAN 6.6): one row per instrument with its raw numbers, data source and age, and the full
// working behind the score on demand. Past-performance figures only; the disclaimer sits above in DataHeader.

const RATIO_METRICS: ReadonlySet<Metric> = new Set(['r1m', 'r3m', 'r6m', 'r12m', 'trend']);

function useMetricText() {
  const loc = intlLocale(useLocale());
  return (m: Metric, v: number | null): string | null => {
    if (v === null) return null;
    if (m === 'cost') return `${formatBp(v, loc)} %`;
    if (m === 'riskAdjusted') return new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(v).replace('-', '−');
    return formatPct(v, loc, RATIO_METRICS.has(m));
  };
}

/** Source and age of the latest price, or the stale warning in words with an icon. */
export function Freshness({ row }: { row: Pick<InsightRow, 'source' | 'lastDate' | 'stale' | 'expectedDate'> }) {
  const t = useTranslations('investing');
  const locale = useLocale();
  const day = (d: string) => formatDay(d, locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      {row.source && row.lastDate && (
        <span className="text-ink-2">
          {t(`source.${row.source}`)} · {day(row.lastDate)}
        </span>
      )}
      {!row.lastDate && <span className="text-ink-3">{t('noPrice')}</span>}
      {row.stale && row.lastDate && (
        <span className="inline-flex items-center gap-1 font-medium text-warning">
          <AlertTriangle aria-hidden className="size-3.5" strokeWidth={2} />
          {t('stale')}: {t('staleSince', { date: day(row.expectedDate) })}
        </span>
      )}
    </span>
  );
}

function Working({ row, weights }: { row: InsightRow; weights: Weights }) {
  const t = useTranslations('investing');
  const loc = intlLocale(useLocale());
  const text = useMetricText();
  return (
    <details className="group mt-3">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-accent hover:underline [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" strokeWidth={2} />
        {t('why')}
      </summary>
      <div className="mt-2 max-w-3xl">
        <p className="mb-3 text-sm text-ink-2">{t('whyIntro')}</p>
        <table className="w-full text-left text-sm">
          <thead className="text-ink-2">
            <tr className="border-b border-rule">
              <th scope="col" className="py-1.5 font-medium">{t('figure')}</th>
              <th scope="col" className="py-1.5 text-right font-medium">{t('value')}</th>
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">{t('percentile')}</th>
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">{t('weight')}</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const p = row.percentiles[m];
              return (
                <tr key={m} className="border-b border-rule">
                  <th scope="row" className="py-1.5 pr-2 font-normal">{t(`metric.${m}`)}</th>
                  <td className="num py-1.5 text-right whitespace-nowrap">{text(m, row.metrics[m]) ?? <span className="text-ink-3">{t('noData')}</span>}</td>
                  <td className="num py-1.5 pl-3 text-right">{p === undefined ? '—' : formatScore(p, loc)}</td>
                  <td className="num py-1.5 pl-3 text-right text-ink-2">{weights[m]}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <th scope="row" className="py-1.5">{t('score')}</th>
              <td />
              <td className="num py-1.5 pl-3 text-right">{formatScore(row.score, loc)}</td>
              <td className="py-1.5 pl-3 text-right text-xs font-normal text-ink-2">{t('coverage', { pct: Math.round(row.coverage * 100) })}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Identity({ row }: { row: InsightRow }) {
  const t = useTranslations('investing');
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-lg font-semibold">{row.symbol}</span>
        <span className="text-sm text-ink-2">{EXCHANGE_INFO[row.item.exchange].label} · {row.item.currency}</span>
        {row.item.core && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-ink-2">
            <span aria-hidden className="size-2 rounded-full bg-chart-3" />
            {t('core')}
          </span>
        )}
      </p>
      <p className="text-sm text-ink-2">{row.item.name}</p>
      {row.item.euRetailNote && (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-2">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {t('euNote')}
        </p>
      )}
    </div>
  );
}

function Price({ row, currency }: { row: InsightRow; currency: string }) {
  const loc = intlLocale(useLocale());
  if (row.lastPriceMicros === null) return <span className="text-ink-3">—</span>;
  return (
    <span className="flex flex-col items-end">
      {row.lastEurMinor !== null && <Money minor={row.lastEurMinor} currency={currency} locale={loc} className="font-medium" />}
      {row.item.currency !== currency && <span className="num text-sm text-ink-2">{formatPrice(row.lastPriceMicros, row.item.currency, loc)}</span>}
    </span>
  );
}

export function RankingView({ rows, weights, currency }: { rows: InsightRow[]; weights: Weights; currency: string }) {
  const t = useTranslations('investing');
  const loc = intlLocale(useLocale());
  const text = useMetricText();
  const ranked = rows.filter((r) => r.rank !== null);
  const unranked = rows.filter((r) => r.rank === null);

  return (
    <>
      {ranked.length > 0 && (
        <Section title={t('tabs.ranking')}>
          <ol className="border-t border-rule">
            {ranked.map((r) => (
              <li key={r.key} className="border-b border-rule py-4">
                <div className="grid grid-cols-[2rem_1fr_auto] items-start gap-x-3 sm:grid-cols-[2.5rem_1fr_auto_auto] sm:gap-x-6">
                  <span className="num pt-0.5 text-lg font-semibold text-ink-2" aria-label={`${t('rank')} ${r.rank}`}>
                    {r.rank}
                  </span>
                  <div className="min-w-0">
                    <Identity row={r} />
                    <p className="num mt-1 text-sm text-ink-2">
                      {[
                        `${t('short.r12m')} ${text('r12m', r.metrics.r12m) ?? '—'}`,
                        `${t('short.volatility')} ${text('volatility', r.metrics.volatility) ?? '—'}`,
                        r.metrics.cost !== null ? `TER ${text('cost', r.metrics.cost)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <div className="mt-1">
                      <Freshness row={r} />
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <Price row={r} currency={currency} />
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-ink-2">{t('score')}</span>
                    <span className="num text-2xl font-semibold">{formatScore(r.score, loc)}</span>
                    <span className="mt-1 block sm:hidden">
                      <Price row={r} currency={currency} />
                    </span>
                  </div>
                </div>
                <div className="pl-[2.75rem] sm:pl-[4rem]">
                  <Working row={r} weights={weights} />
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {unranked.length > 0 && (
        <Section title={t('insufficientTitle')}>
          <ul className="border-t border-rule">
            {unranked.map((r) => (
              <li key={r.key} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-rule py-4">
                <div className="min-w-0">
                  <Identity row={r} />
                  <p className="mt-1 text-sm text-ink-2">{t('insufficientRow', { points: r.points })}</p>
                  <div className="mt-1">
                    <Freshness row={r} />
                  </div>
                </div>
                <Price row={r} currency={currency} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
