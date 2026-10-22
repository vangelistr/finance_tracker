import { removeContribution } from '@/server/services/goals';
import { requireId } from '@/server/services/ids';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const DELETE = api<{ id: string; cid: string }>('user', async ({ params, auth }) => {
  if (!(await removeContribution(auth!.user._id, requireId(params.id), requireId(params.cid)))) throw notFound();
  return { ok: true };
});
