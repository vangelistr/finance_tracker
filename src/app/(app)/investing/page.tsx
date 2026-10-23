import { getTranslations } from 'next-intl/server';
import { DataHeader, summarise } from '@/components/investing/data-header';
import { DataStatus } from '@/components/investing/data-status';
import { RankingView } from '@/components/investing/ranking';
import { EmptyState } from '@/components/ui/empty-state';
import { requireInvestingUser } from '@/server/auth/investing';
import { dataStatus, loadInsights } from '@/server/services/investing';

export async function generateMetadata() {
  const t = await getTranslations('investing');
  return { title: `${t('tabs.ranking')} · ${t('title')}` };
}

export default async function RankingPage() {
  const { user } = await requireInvestingUser();
  const [t, insights, status] = await Promise.all([getTranslations('investing'), loadInsights(user), dataStatus(user)]);
  const hasPrices = insights.rows.some((r) => r.lastDate);
  return (
    <>
      <DataHeader summary={summarise(insights.rows, insights.fx?.date ?? null)} />
      {insights.rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
      ) : (
        <>
          {!hasPrices && <EmptyState title={t('noPricesTitle')} body={t('noPricesBody')} />}
          <RankingView rows={insights.rows} weights={insights.settings.weights} currency={user.currency} />
        </>
      )}
      <DataStatus data={status} />
    </>
  );
}
