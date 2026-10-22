import { getLocale, getTranslations } from 'next-intl/server';
import { MonthLine } from '@/components/data/month-line';
import { Money } from '@/components/data/money';
import { PageHeader, Section } from '@/components/shell/page-header';
import { monthOf, toLocalDate } from '@/lib/dates';
import { requireUser } from '@/server/auth/current';

export async function generateMetadata() {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

export default async function DashboardPage() {
  const { user } = await requireUser();
  const t = await getTranslations('dashboard');
  const locale = await getLocale();
  const intlLocale = locale === 'el' ? 'el-GR' : 'en-IE';
  const today = toLocalDate(new Date(), user.timezone);
  const month = monthOf(today);
  const monthName = new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );

  // Phase 1: the ledger is empty until transactions exist (Phase 2).
  const totals = { in: 0, out: 0 };

  return (
    <>
      <PageHeader title={t('title')} meta={<span className="capitalize">{monthName}</span>} />
      <dl className="grid grid-cols-3 gap-4 pb-6">
        {[
          { key: 'monthIn', value: totals.in, tone: 'text-income' },
          { key: 'monthOut', value: totals.out, tone: 'text-spend' },
          { key: 'monthLeft', value: totals.in - totals.out, tone: 'text-ink' },
        ].map((item) => (
          <div key={item.key} className="min-w-0">
            <dt className="text-sm text-ink-2">{t(item.key)}</dt>
            <dd className={`mt-1 text-xl font-semibold tracking-[-0.01em] sm:text-3xl ${item.value === 0 ? 'text-ink' : item.tone}`}>
              <Money minor={item.value} currency={user.currency} locale={intlLocale} />
            </dd>
          </div>
        ))}
      </dl>
      <Section title={t('monthLine')}>
        <MonthLine month={month} today={today} stations={[]} summary={t('emptyTitle')} todayLabel={t('today')} />
        <div className="mt-4 max-w-prose">
          <p className="font-semibold">{t('emptyTitle')}</p>
          <p className="mt-1 text-ink-2">{t('emptyBody')}</p>
        </div>
      </Section>
    </>
  );
}
