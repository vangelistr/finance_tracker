import { getTranslations } from 'next-intl/server';
import { Goals } from '@/components/finance/goals';
import { PageHeader } from '@/components/shell/page-header';
import { toLocalDate } from '@/lib/dates';
import { requireUser } from '@/server/auth/current';
import { goalDto } from '@/server/services/dto';
import { listGoals } from '@/server/services/goals';
import { lookups } from '@/server/services/lookups';

export async function generateMetadata() {
  const t = await getTranslations('goals');
  return { title: t('title') };
}

export default async function GoalsPage() {
  const { user } = await requireUser();
  const t = await getTranslations('goals');
  const [list, l] = await Promise.all([listGoals(user._id, user.timezone), lookups(user._id)]);
  const rows = list.map((x) => ({
    ...goalDto(x.goal),
    savedMinor: x.savedMinor,
    status: x.status,
    contributions: x.contributions.map((c) => ({ id: c._id.toHexString(), amountMinor: c.amountMinor, localDate: c.localDate, source: c.source })),
  }));
  return (
    <>
      <PageHeader title={t('title')} />
      <Goals rows={rows} accounts={l.accountOptions} currency={user.currency} today={toLocalDate(new Date(), user.timezone)} />
    </>
  );
}
