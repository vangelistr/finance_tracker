import { watchlistPatchSchema } from '@/lib/validation/investing';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';
import { requireId } from '@/server/services/ids';
import { assertInvesting, deleteInstrument, updateInstrument, watchlistDto } from '@/server/services/investing';

export const PATCH = api<{ id: string }>('user', async ({ params, body, auth }) => {
  const { user } = auth!;
  assertInvesting(user);
  const updated = await updateInstrument(user._id, requireId(params.id), await body(watchlistPatchSchema));
  if (!updated) throw notFound();
  return { instrument: watchlistDto(updated) };
});

/** Removes the listing from this user's watchlist with its manual prices; the shared price cache expires by TTL. */
export const DELETE = api<{ id: string }>('user', async ({ params, auth }) => {
  const { user } = auth!;
  assertInvesting(user);
  if (!(await deleteInstrument(user._id, requireId(params.id)))) throw notFound();
  return { ok: true };
});
