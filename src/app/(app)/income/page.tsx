import { getLocale, getTranslations } from 'next-intl/server';
import { IncomeSources, RecordIncome } from '@/components/finance/income-sources';
import { Ledger } from '@/components/finance/ledger';
import { MonthNav } from '@/components/shell/month-nav';
import { PageHeader, Section } from '@/components/shell/page-header';
import { isMonth, monthOf, toLocalDate } from '@/lib/dates';
import { requireUser } from '@/server/auth/current';
import { incomeSourceDto } from '@/server/services/dto';
import { generateForUser } from '@/server/services/generation';
import { ledgerRow, lookups } from '@/server/services/lookups';
import { listIncomeSources } from '@/server/services/sources';
import { listTransactions } from '@/server/services/transactions';

export async function generateMetadata() {
  const t = await getTranslations('income');
  return { title: t('title') };
}

export default async function IncomePage({ searchParams }: PageProps<'/income'>) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const t = await getTranslations('income');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const today = toLocalDate(new Date(), user.timezone);
  const month = typeof sp.month === 'string' && isMonth(sp.month) ? sp.month : monthOf(today);

  await generateForUser(user._id, user.timezone);
  const [sources, entries, l] = await Promise.all([
    listIncomeSources(user._id, { includeInactive: true }),
    listTransactions(user._id, { month, kind: 'income', limit: 500 }),
    lookups(user._id),
  ]);
  const rows = entries.map((x) => ledgerRow(x, l, (a, b) => `${a} → ${b}`));
  const sourceRows = sources.map(incomeSourceDto);

  return (
    <>
      <PageHeader title={t('title')} actions={<RecordIncome sources={sourceRows} accounts={l.accountOptions} currency={user.currency} today={today} />} />
      <Section title={t('thisMonth')} aside={<MonthNav month={month} locale={locale} basePath="/income" labels={{ prev: tc('previousMonth'), next: tc('nextMonth') }} />}>
        <Ledger rows={rows} categories={l.categoryOptions} accounts={l.accountOptions} currency={user.currency} emptyTitle={t('noEntries')} />
      </Section>
      <Section title={t('sources')}>
        <IncomeSources sources={sourceRows} categories={l.categoryOptions.income} accounts={l.accountOptions} currency={user.currency} today={today} />
      </Section>
    </>
  );
}
