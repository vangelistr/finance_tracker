import { getTranslations } from 'next-intl/server';
import { FixedCosts } from '@/components/finance/fixed-costs';
import { PageHeader } from '@/components/shell/page-header';
import { toLocalDate } from '@/lib/dates';
import { nextOccurrence } from '@/lib/recurrence';
import { requireUser } from '@/server/auth/current';
import { recurringExpenseDto } from '@/server/services/dto';
import { lookups } from '@/server/services/lookups';
import { listRecurringExpenses } from '@/server/services/sources';

export async function generateMetadata() {
  const t = await getTranslations('fixed');
  return { title: t('title') };
}

export default async function FixedPage() {
  const { user } = await requireUser();
  const t = await getTranslations('fixed');
  const today = toLocalDate(new Date(), user.timezone);
  const [list, l] = await Promise.all([listRecurringExpenses(user._id, { includeInactive: true }), lookups(user._id)]);
  const rows = list.map((e) => recurringExpenseDto(e, e.active ? nextOccurrence(e.schedule, today) : null));
  return (
    <>
      <PageHeader title={t('title')} />
      <FixedCosts
        rows={rows}
        categories={l.categoryOptions.expense}
        accounts={l.accountOptions}
        currency={user.currency}
        today={today}
        defaultReminder={user.settings.notifications.renewals.defaultDaysBefore}
      />
    </>
  );
}
