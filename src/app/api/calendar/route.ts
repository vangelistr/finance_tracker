import { z } from 'zod';
import { monthOf, toLocalDate } from '@/lib/dates';
import { monthSchema } from '@/lib/validation/common';
import { getCalendar } from '@/server/services/calendar';
import { api } from '@/server/http/api';

export const GET = api('user', async ({ query, auth }) => {
  const { user } = auth!;
  const { month } = query(z.strictObject({ month: monthSchema.optional() }));
  return getCalendar(user._id, month ?? monthOf(toLocalDate(new Date(), user.timezone)), user.timezone);
});
