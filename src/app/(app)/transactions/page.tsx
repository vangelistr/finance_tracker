import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Money } from '@/components/data/money';
import { Ledger } from '@/components/finance/ledger';
import { MonthNav } from '@/components/shell/month-nav';
import { PageHeader } from '@/components/shell/page-header';
import { cn } from '@/lib/cn';
import { isMonth, monthOf, toLocalDate } from '@/lib/dates';
import { intlLocale } from '@/lib/intl';
import { requireUser } from '@/server/auth/current';
import { generateForUser } from '@/server/services/generation';
import { ledgerRow, lookups } from '@/server/services/lookups';
import { listTransactions } from '@/server/services/transactions';

const FILTERS = ['all', 'income', 'expense', 'expected'] as const;
type Filter = (typeof FILTERS)[number];

export async function generateMetadata() {
  const t = await getTranslations('transactions');
  return { title: t('title') };
}

export default async function TransactionsPage({ searchParams }: PageProps<'/transactions'>) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const t = await getTranslations('transactions');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const month = typeof sp.month === 'string' && isMonth(sp.month) ? sp.month : monthOf(toLocalDate(new Date(), user.timezone));
  const filter: Filter = FILTERS.includes(sp.filter as Filter) ? (sp.filter as Filter) : 'all';

  await generateForUser(user._id, user.timezone);
  const [all, l] = await Promise.all([listTransactions(user._id, { month, limit: 500 }), lookups(user._id)]);
  const visible = all.filter((x) =>
    filter === 'all' ? true : filter === 'expected' ? x.status === 'expected' : x.kind === filter,
  );
  const done = all.filter((x) => x.status === 'done');
  const inMinor = done.filter((x) => x.kind === 'income').reduce((s, x) => s + x.amountMinor, 0);
  const outMinor = done.filter((x) => x.kind === 'expense').reduce((s, x) => s + x.amountMinor, 0);
  const rows = visible.map((x) => ledgerRow(x, l, (from, to) => `${from || '—'} → ${to || '—'}`));
  const loc = intlLocale(locale);

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={<MonthNav month={month} locale={locale} basePath="/transactions" query={filter === 'all' ? {} : { filter }} labels={{ prev: tc('previousMonth'), next: tc('nextMonth') }} />}
      />
      <dl className="grid grid-cols-3 gap-4 pb-5">
        {[
          { label: t('inTotal'), value: inMinor, cls: inMinor ? 'text-income' : '' },
          { label: t('outTotal'), value: -outMinor, cls: '' },
          { label: t('net'), value: inMinor - outMinor, cls: '' },
        ].map((x) => (
          <div key={x.label}>
            <dt className="text-sm text-ink-2">{x.label}</dt>
            <dd className={cn('text-lg font-semibold sm:text-xl', x.cls)}>
              <Money minor={x.value} currency={user.currency} locale={loc} />
            </dd>
          </div>
        ))}
      </dl>
      <nav aria-label={t('title')} className="-mx-1 flex gap-1 overflow-x-auto pb-3">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/transactions?${new URLSearchParams({ month, ...(f === 'all' ? {} : { filter: f }) })}`}
            aria-current={filter === f ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm',
              filter === f ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-rule-strong text-ink-2 hover:text-ink',
            )}
          >
            {t(`filter${f.charAt(0).toUpperCase()}${f.slice(1)}` as 'filterAll')}
          </Link>
        ))}
      </nav>
      <Ledger
        rows={rows}
        categories={l.categoryOptions}
        accounts={l.accountOptions}
        currency={user.currency}
        emptyTitle={t('empty')}
        emptyBody={t('emptyHint')}
      />
    </>
  );
}
