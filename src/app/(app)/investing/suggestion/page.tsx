import { getTranslations } from 'next-intl/server';
import { DataHeader, summarise } from '@/components/investing/data-header';
import { SuggestionView } from '@/components/investing/suggestion';
import { requireInvestingUser } from '@/server/auth/investing';
import { loadSuggestion } from '@/server/services/investing';

export async function generateMetadata() {
  const t = await getTranslations('investing');
  return { title: `${t('tabs.suggestion')} · ${t('title')}` };
}

export default async function SuggestionPage() {
  const { user } = await requireInvestingUser();
  const { insights, split, profile, plan } = await loadSuggestion(user);
  const names = Object.fromEntries(insights.rows.map((r) => [r.key, r.item.name]));
  return (
    <>
      <DataHeader summary={summarise(insights.rows, insights.fx?.date ?? null)} />
      <SuggestionView data={{ split, profile, plan, guardrails: insights.settings.guardrails, names }} currency={user.currency} />
    </>
  );
}
