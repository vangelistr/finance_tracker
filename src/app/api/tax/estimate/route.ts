import { z } from 'zod';
import { zonedParts } from '@/lib/dates';
import { api } from '@/server/http/api';
import { loadTax } from '@/server/services/tax';

const query = z.strictObject({ year: z.coerce.number().int().min(2000).max(2100).optional() });

export const GET = api('user', async ({ query: q, auth }) => {
  const { user } = auth!;
  const { year } = q(query);
  const v = await loadTax(user, year ?? zonedParts(new Date(), user.timezone).year);
  return {
    taxYear: v.taxYear,
    configYear: v.configYear,
    configFallback: v.configFallback,
    profile: v.profile,
    full: v.full,
    yearToDate: v.ytd,
    reserve: v.reserve,
    movedThisYearMinor: v.movedThisYearMinor,
    dueNowMinor: v.dueNowMinor,
    setAside: Object.fromEntries(v.moved),
    disclaimer: 'estimate, not tax advice; confirm with an accountant',
  };
});
