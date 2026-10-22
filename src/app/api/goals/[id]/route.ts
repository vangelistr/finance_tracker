import { goalPatchSchema } from '@/lib/validation/goals';
import { updateGoal } from '@/server/services/goals';
import { assertRefsOwned, optionalRef, requireId } from '@/server/services/ids';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';
import { goalDto } from '@/server/services/dto';

export const PATCH = api<{ id: string }>('user', async ({ params, body, auth }) => {
  const userId = auth!.user._id;
  const input = await body(goalPatchSchema);
  const { accountId: rawAccount, ...rest } = input;
  const patch = { ...rest, ...(rawAccount !== undefined ? { accountId: optionalRef(rawAccount) } : {}) };
  await assertRefsOwned(userId, { account: [patch.accountId] });
  const updated = await updateGoal(userId, requireId(params.id), patch);
  if (!updated) throw notFound();
  return { goal: goalDto(updated) };
});

/** Goals are archived, never deleted, so their contributions stay in the history. */
export const DELETE = api<{ id: string }>('user', async ({ params, auth }) => {
  const updated = await updateGoal(auth!.user._id, requireId(params.id), { archived: true });
  if (!updated) throw notFound();
  return { result: 'archived' };
});
