import { getTranslations } from 'next-intl/server';
import { Watchlist } from '@/components/investing/watchlist';
import { toLocalDate } from '@/lib/dates';
import { requireInvestingUser } from '@/server/auth/investing';
import { loadInsights } from '@/server/services/investing';

export async function generateMetadata() {
  const t = await getTranslations('investing');
  return { title: `${t('tabs.watchlist')} · ${t('title')}` };
}

export default async function WatchlistPage() {
  const { user } = await requireInvestingUser();
  const insights = await loadInsights(user);
  // Watchlist order (as added), not ranking order.
  const rows = insights.rows
    .map((r) => ({ ...r.item, lastDate: r.lastDate, lastPriceMicros: r.lastPriceMicros, source: r.source, stale: r.stale }))
    .sort((a, b) => insights.order.indexOf(a.id) - insights.order.indexOf(b.id));
  return <Watchlist rows={rows} today={toLocalDate(new Date(), user.timezone)} />;
}
