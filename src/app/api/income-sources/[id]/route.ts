import { incomeSourcePatchSchema } from '@/lib/validation/finance';
import { incomeSourceDto } from '@/server/services/dto';
import { assertRefsOwned, optionalRef, requireId } from '@/server/services/ids';
import { deactivateIncomeSource, updateIncomeSource, type IncomeSourceInput } from '@/server/services/sources';
import { api } from '@/server/http/api';
import { ApiError, notFound } from '@/server/http/errors';

export const PATCH = api<{ id: string }>('user', async ({ params, body, auth }) => {
  const { user } = auth!;
  const input = await body(incomeSourcePatchSchema);
  const patch: Partial<IncomeSourceInput> = {};
  for (const key of ['name', 'type', 'currency', 'freelance', 'active'] as const) if (input[key] !== undefined) (patch as Record<string, unknown>)[key] = input[key];
  if (input.schedule !== undefined) patch.schedule = input.schedule ?? null;
  if (input.expectedNetMinor !== undefined) patch.expectedNetMinor = input.expectedNetMinor ?? null;
  if (input.expectedGrossMinor !== undefined) patch.expectedGrossMinor = input.expectedGrossMinor ?? null;
  if (input.categoryId !== undefined) patch.categoryId = optionalRef(input.categoryId);
  if (input.accountId !== undefined) patch.accountId = optionalRef(input.accountId);
  await assertRefsOwned(user._id, { category: [patch.categoryId], account: [patch.accountId] });
  const updated = await updateIncomeSource(user._id, requireId(params.id), patch, user.timezone);
  if (!updated) throw notFound();
  if (updated.type === 'recurring_fixed' && (!updated.schedule || !updated.expectedNetMinor)) {
    throw new ApiError(400, 'validation', 'a fixed income needs a schedule and an expected net amount', { schedule: 'required' });
  }
  return { incomeSource: incomeSourceDto(updated) };
});

export const DELETE = api<{ id: string }>('user', async ({ params, auth }) => {
  const { user } = auth!;
  if (!(await deactivateIncomeSource(user._id, requireId(params.id), user.timezone))) throw notFound();
  return { result: 'deactivated' };
});
