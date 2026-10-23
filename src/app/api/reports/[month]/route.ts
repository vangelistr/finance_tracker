import { isMonth } from '@/lib/dates';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';
import { ensureReport } from '@/server/services/reports';

/** A closed month's snapshot (generated on first request). There is no update endpoint: reports are immutable. */
export const GET = api<{ month: string }>('user', async ({ params, auth }) => {
  if (!isMonth(params.month)) throw notFound();
  const report = await ensureReport(auth!.user, params.month);
  if (!report) throw notFound();
  return { month: report.month, generatedAt: report.generatedAt, schemaVersion: report.schemaVersion, data: report.data };
});
