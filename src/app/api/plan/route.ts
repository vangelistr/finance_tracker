import { loadPlan } from '@/server/services/plan';
import { api } from '@/server/http/api';

export const GET = api('user', async ({ auth }) => {
  const { plan, settings, month, inputs } = await loadPlan(auth!.user);
  return { month, plan, settings, inputs, disclaimer: 'educational, not financial advice' };
});
