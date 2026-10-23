import { AlertTriangle, CircleCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Notice } from '@/components/ui/notice';
import { formatDay } from '@/lib/intl';

export interface DataSummary {
  newestDate: string | null;
  fxDate: string | null;
  stale: number;
  total: number;
}

export function summarise(rows: Array<{ lastDate: string | null; stale: boolean }>, fxDate: string | null): DataSummary {
  const dates = rows.map((r) => r.lastDate).filter((d): d is string => !!d).sort();
  return { newestDate: dates.at(-1) ?? null, fxDate, stale: rows.filter((r) => r.stale).length, total: rows.length };
}

/** The disclaimer and the data age that every investing view shows above its result (brief 11f). */
export function DataHeader({ summary }: { summary: DataSummary }) {
  const t = useTranslations('investing');
  const td = useTranslations('disclaimers');
  const locale = useLocale();
  const day = (d: string) => formatDay(d, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="mb-6 flex flex-col gap-3">
      <Notice tone="info">{td('investing')}</Notice>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        <span>{summary.newestDate ? t('dataAsOf', { date: day(summary.newestDate) }) : t('dataNone')}</span>
        <span>{summary.fxDate ? t('fxAsOf', { date: day(summary.fxDate) }) : t('fxNone')}</span>
        {summary.total > 0 &&
          (summary.stale > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-warning">
              <AlertTriangle aria-hidden className="size-4" strokeWidth={2} />
              {t('staleCount', { count: summary.stale })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck aria-hidden className="size-4 text-ink-3" strokeWidth={2} />
              {t('allCurrent')}
            </span>
          ))}
      </p>
    </div>
  );
}
