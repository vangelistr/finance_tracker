import { toLocalDate } from '@/lib/dates';
import { nextOccurrence } from '@/lib/recurrence';
import { recurringExpenseCreateSchema } from '@/lib/validation/finance';
import { recurringExpenseDto } from '@/server/services/dto';
import { assertRefsOwned, optionalRef } from '@/server/services/ids';
import { createRecurringExpense, listRecurringExpenses } from '@/server/services/sources';
import { api } from '@/server/http/api';

export const GET = api('user', async ({ auth }) => {
  const { user } = auth!;
  const today = toLocalDate(new Date(), user.timezone);
  const list = await listRecurringExpenses(user._id, { includeInactive: true });
  return { recurringExpenses: list.map((e) => recurringExpenseDto(e, e.active ? nextOccurrence(e.schedule, today) : null)) };
});

export const POST = api('user', async ({ body, auth }) => {
  const { user } = auth!;
  const input = await body(recurringExpenseCreateSchema);
  const categoryId = optionalRef(input.categoryId);
  const accountId = optionalRef(input.accountId);
  await assertRefsOwned(user._id, { category: [categoryId], account: [accountId] });
  const doc = await createRecurringExpense(
    user._id,
    {
      name: input.name,
      amountMinor: input.amountMinor,
      categoryId,
      accountId,
      schedule: { ...input.schedule, endDate: input.schedule.endDate ?? null, dayOfMonth: input.schedule.dayOfMonth ?? null },
      subscription: input.subscription,
      note: input.note,
      active: input.active,
    },
    user.timezone,
  );
  return { recurringExpense: recurringExpenseDto(doc, nextOccurrence(doc.schedule, toLocalDate(new Date(), user.timezone))) };
});
