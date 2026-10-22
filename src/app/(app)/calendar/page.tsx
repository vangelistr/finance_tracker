import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarView } from '@/components/finance/calendar-view';
import { MonthNav } from '@/components/shell/month-nav';
import { PageHeader } from '@/components/shell/page-header';
import { isMonth, monthOf, toLocalDate } from '@/lib/dates';
import { requireUser } from '@/server/auth/current';
import { getCalendar } from '@/server/services/calendar';
import { lookups } from '@/server/services/lookups';

export async function generateMetadata() {
  const t = await getTranslations('calendar');
  return { title: t('title') };
}

export default async function CalendarPage({ searchParams }: PageProps<'/calendar'>) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const t = await getTranslations('calendar');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const month = typeof sp.month === 'string' && isMonth(sp.month) ? sp.month : monthOf(toLocalDate(new Date(), user.timezone));
  const [cal, l] = await Promise.all([getCalendar(user._id, month, user.timezone), lookups(user._id)]);
  return (
    <>
      <PageHeader title={t('title')} actions={<MonthNav month={month} locale={locale} basePath="/calendar" labels={{ prev: tc('previousMonth'), next: tc('nextMonth') }} />} />
      <CalendarView weeks={cal.weeks} days={cal.days} today={cal.today} currency={user.currency} categories={l.categoryOptions.expense} />
    </>
  );
}
