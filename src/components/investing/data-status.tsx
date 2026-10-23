import { useLocale, useTranslations } from 'next-intl';
import { Section } from '@/components/shell/page-header';
import { Notice } from '@/components/ui/notice';
import { formatDay } from '@/lib/intl';
import type { ProviderId } from '@/lib/investing/instruments';

export interface DataStatusData {
  providers: Array<{ id: ProviderId; configured: boolean; dailyBudget: number; callsToday: number; blocked: boolean }>;
  fx: { date: string | null; fetchedAt: string | null; lastError: string | null };
}

/** Which providers have keys (never the keys), today's calls against the app budget, and the FX source. */
export function DataStatus({ data }: { data: DataStatusData }) {
  const t = useTranslations('investing');
  const locale = useLocale();
  const anyKey = data.providers.some((p) => p.configured);
  return (
    <Section title={t('status')}>
      {!anyKey && (
        <Notice tone="warning" className="mb-4">
          {t('noKeys')}
        </Notice>
      )}
      <table className="w-full max-w-2xl text-left">
        <thead className="text-sm text-ink-2">
          <tr className="border-b border-rule">
            <th scope="col" className="py-2 font-medium">{t('provider')}</th>
            <th scope="col" className="py-2 font-medium">{t('key')}</th>
            <th scope="col" className="py-2 text-right font-medium">{t('callsToday')}</th>
          </tr>
        </thead>
        <tbody>
          {data.providers.map((p) => (
            <tr key={p.id} className="border-b border-rule align-baseline">
              <th scope="row" className="py-2.5 font-medium">{t(`source.${p.id}`)}</th>
              <td className="py-2.5 text-ink-2">
                {p.configured ? t('keySet') : t('noKey')}
                {p.blocked && <span className="block text-sm font-medium text-warning">{t('paused')}</span>}
              </td>
              <td className="num py-2.5 text-right">{t('callsOf', { calls: p.callsToday, budget: p.dailyBudget })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 max-w-prose text-sm text-ink-2">{t('statusHint')}</p>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        {t('fxSource')} {data.fx.date ? t('fxAsOf', { date: formatDay(data.fx.date, locale, { day: 'numeric', month: 'long', year: 'numeric' }) }) : t('fxNone')}
      </p>
    </Section>
  );
}
