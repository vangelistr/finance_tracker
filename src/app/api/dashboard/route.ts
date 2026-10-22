import { z } from 'zod';
import { toLocalDate } from '@/lib/dates';
import { loadDashboard, RANGES } from '@/server/services/dashboard';
import { api } from '@/server/http/api';

export const GET = api('user', async ({ query, auth }) => {
  const { user } = auth!;
  const { range } = query(z.strictObject({ range: z.enum(RANGES).default('month') }));
  return loadDashboard(user._id, range, toLocalDate(new Date(), user.timezone), user.settings.notifications.overspend.thresholds, {
    none: '—',
    other: user.locale === 'el' ? 'Άλλα' : 'Other',
    overall: user.locale === 'el' ? 'Συνολικά' : 'Overall',
  });
});
