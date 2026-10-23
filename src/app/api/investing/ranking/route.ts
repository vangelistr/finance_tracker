import { INVESTING_DISCLAIMER } from '@/lib/investing/settings';
import { api } from '@/server/http/api';
import { assertInvesting, ensureStarter, loadInsights } from '@/server/services/investing';

export const GET = api('user', async ({ auth }) => {
  const { user } = auth!;
  assertInvesting(user);
  await ensureStarter(user);
  const { rows, settings, fx, generatedAt } = await loadInsights(user);
  return { rows, weights: settings.weights, fx, generatedAt, disclaimer: INVESTING_DISCLAIMER };
});
