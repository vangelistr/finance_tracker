import { api } from '@/server/http/api';
import { ensureClosedReports, listReports } from '@/server/services/reports';

export const GET = api('user', async ({ auth }) => {
  const { user } = auth!;
  await ensureClosedReports(user);
  return { reports: (await listReports(user._id)).map((r) => ({ month: r.month, generatedAt: r.generatedAt, totals: r.data.totals, savingsRateBps: r.data.savingsRateBps })) };
});
