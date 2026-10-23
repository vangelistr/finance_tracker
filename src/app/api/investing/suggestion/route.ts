import { INVESTING_DISCLAIMER } from '@/lib/investing/settings';
import { api } from '@/server/http/api';
import { assertInvesting, ensureStarter, loadSuggestion } from '@/server/services/investing';

export const GET = api('user', async ({ auth }) => {
  const { user } = auth!;
  assertInvesting(user);
  await ensureStarter(user);
  const { insights, split, profile, month, plan } = await loadSuggestion(user);
  return { month, plan, profile, guardrails: insights.settings.guardrails, weights: insights.settings.weights, split, fx: insights.fx, generatedAt: insights.generatedAt, disclaimer: INVESTING_DISCLAIMER };
});
