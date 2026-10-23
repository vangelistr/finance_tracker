import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Money } from '@/components/data/money';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMonth, intlLocale } from '@/lib/intl';
import { requireUser } from '@/server/auth/current';
import { ensureClosedReports, listReports } from '@/server/services/reports';

export async function generateMetadata() {
  const t = await getTranslations('reports');
  return { title: t('title') };
}

/** History of month-end snapshots; closed months without one are generated here (lazy path of PLAN 6.7). */
export default async function ReportsPage() {
  const { user } = await requireUser();
  const [t, locale] = await Promise.all([getTranslations('reports'), getLocale()]);
  const loc = intlLocale(locale);
  await ensureClosedReports(user);
  const reports = await listReports(user._id);
  return (
    <>
      <PageHeader title={t('title')} />
      {reports.length === 0 ? (
        <EmptyState title={t('title')} body={t('historyEmpty')} />
      ) : (
        <ul className="border-t border-rule">
          {reports.map((r) => (
            <li key={r.month} className="border-b border-rule">
              <Link href={`/reports/${r.month}`} prefetch={false} className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 py-3 hover:bg-surface-hover sm:grid-cols-[1fr_auto_auto_auto]">
                <span className="font-semibold capitalize">{formatMonth(r.month, locale)}</span>
                <span className="text-right sm:order-last">
                  <Money minor={r.data.totals.netMinor} currency={user.currency} locale={loc} signed className="font-semibold" />
                </span>
                <span className="text-sm text-ink-2">
                  {t('income')} <Money minor={r.data.totals.incomeMinor} currency={user.currency} locale={loc} />
                </span>
                <span className="text-right text-sm text-ink-2 sm:text-left">
                  {t('expenses')} <Money minor={r.data.totals.expenseMinor} currency={user.currency} locale={loc} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
