import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Money } from '@/components/data/money';
import { RecordIncome } from '@/components/finance/income-sources';
import { Ledger } from '@/components/finance/ledger';
import { PageHeader, Section } from '@/components/shell/page-header';
import { addMonthsToMonth, monthOf, toLocalDate } from '@/lib/dates';
import { formatMonth, intlLocale } from '@/lib/intl';
import { requireUser } from '@/server/auth/current';
import { incomeSourceDto } from '@/server/services/dto';
import { generateForUser } from '@/server/services/generation';
import { ledgerRow, lookups } from '@/server/services/lookups';
import { listIncomeSources } from '@/server/services/sources';
import { listTransactions } from '@/server/services/transactions';

export async function generateMetadata() {
  const t = await getTranslations('monthly');
  return { title: t('title') };
}

/** The one flow behind the 1st-of-month notification: last month at a glance, then this month's income. */
export default async function MonthlyPage() {
  const { user } = await requireUser();
  const t = await getTranslations('monthly');
  const td = await getTranslations('dashboard');
  const locale = await getLocale();
  const loc = intlLocale(locale);
  const today = toLocalDate(new Date(), user.timezone);
  const month = monthOf(today);
  const previous = addMonthsToMonth(month, -1);

  await generateForUser(user._id, user.timezone);
  const [last, income, sources, l] = await Promise.all([
    listTransactions(user._id, { month: previous, status: 'done', limit: 1000 }),
    listTransactions(user._id, { month, kind: 'income', limit: 500 }),
    listIncomeSources(user._id),
    lookups(user._id),
  ]);
  const inMinor = last.filter((x) => x.kind === 'income').reduce((s, x) => s + x.amountMinor, 0);
  const outMinor = last.filter((x) => x.kind === 'expense').reduce((s, x) => s + x.amountMinor, 0);
  const rows = income.map((x) => ledgerRow(x, l, (a, b) => `${a} → ${b}`));

  return (
    <>
      <PageHeader title={t('title')} meta={<span className="capitalize">{formatMonth(month, locale)}</span>} />
      <Section title={t('lastMonth', { month: formatMonth(previous, locale) })}>
        <dl className="grid grid-cols-3 gap-4">
          {[
            { label: td('monthIn'), value: inMinor },
            { label: td('monthOut'), value: outMinor },
            { label: t('saved'), value: inMinor - outMinor },
          ].map((x) => (
            <div key={x.label}>
              <dt className="text-sm text-ink-2">{x.label}</dt>
              <dd className="text-xl font-semibold">
                <Money minor={x.value} currency={user.currency} locale={loc} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href={`/reports/${previous}`} prefetch={false} className="font-medium text-accent hover:underline">
            {t('report')}
          </Link>
          {user.settings.investingEnabled && (
            <Link href="/investing/suggestion" prefetch={false} className="font-medium text-accent hover:underline">
              {t('investing')}
            </Link>
          )}
        </div>
      </Section>
      <Section title={t('income')}>
        <p className="mb-3 text-ink-2">{t('incomeHint')}</p>
        <div className="mb-4">
          <RecordIncome sources={sources.map(incomeSourceDto)} accounts={l.accountOptions} currency={user.currency} today={today} />
        </div>
        <Ledger rows={rows} categories={l.categoryOptions} accounts={l.accountOptions} currency={user.currency} emptyTitle={t('noExpected')} />
      </Section>
    </>
  );
}
