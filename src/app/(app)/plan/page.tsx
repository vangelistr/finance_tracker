import { getLocale, getTranslations } from 'next-intl/server';
import { PlanView } from '@/components/finance/plan';
import { ApplyPlan, PlanOverrides } from '@/components/finance/plan-controls';
import { PageHeader } from '@/components/shell/page-header';
import { formatMonth } from '@/lib/intl';
import { requireUser } from '@/server/auth/current';
import { loadPlan } from '@/server/services/plan';

export async function generateMetadata() {
  const t = await getTranslations('plan');
  return { title: t('title') };
}

export default async function PlanPage() {
  const { user } = await requireUser();
  const [t, locale, data] = await Promise.all([getTranslations('plan'), getLocale(), loadPlan(user)]);
  const month = formatMonth(data.month, locale);
  return (
    <>
      <PageHeader title={t('title')} meta={month.charAt(0).toUpperCase() + month.slice(1)} />
      <PlanView
        data={data}
        currency={user.currency}
        apply={<ApplyPlan />}
        // Remounts the form after a save or a reset so it shows the stored values.
        overrides={<PlanOverrides key={JSON.stringify(data.settings)} settings={data.settings} currency={user.currency} />}
      />
    </>
  );
}
