import { toLocalDate } from '@/lib/dates';
import { nextOccurrence } from '@/lib/recurrence';
import { recurringExpensePatchSchema } from '@/lib/validation/finance';
import { recurringExpenseDto } from '@/server/services/dto';
import { assertRefsOwned, optionalRef, requireId } from '@/server/services/ids';
import { deactivateRecurringExpense, updateRecurringExpense, type RecurringExpenseInput } from '@/server/services/sources';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const PATCH = api<{ id: string }>('user', async ({ params, body, auth }) => {
  const { user } = auth!;
  const input = await body(recurringExpensePatchSchema);
  const patch: Partial<RecurringExpenseInput> = {};
  for (const key of ['name', 'amountMinor', 'note', 'active', 'subscription'] as const) if (input[key] !== undefined) (patch as Record<string, unknown>)[key] = input[key];
  if (input.schedule) patch.schedule = { ...input.schedule, endDate: input.schedule.endDate ?? null, dayOfMonth: input.schedule.dayOfMonth ?? null };
  if (input.categoryId !== undefined) patch.categoryId = optionalRef(input.categoryId);
  if (input.accountId !== undefined) patch.accountId = optionalRef(input.accountId);
  await assertRefsOwned(user._id, { category: [patch.categoryId], account: [patch.accountId] });
  const updated = await updateRecurringExpense(user._id, requireId(params.id), patch, user.timezone);
  if (!updated) throw notFound();
  return { recurringExpense: recurringExpenseDto(updated, updated.active ? nextOccurrence(updated.schedule, toLocalDate(new Date(), user.timezone)) : null) };
});

export const DELETE = api<{ id: string }>('user', async ({ params, auth }) => {
  const { user } = auth!;
  if (!(await deactivateRecurringExpense(user._id, requireId(params.id), user.timezone))) throw notFound();
  return { result: 'deactivated' };
});
