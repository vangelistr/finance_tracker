import { col } from '@/server/db/collections';
import { requireId } from '@/server/services/ids';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const POST = api<{ id: string }>('user', async ({ params, auth }) => {
  const { notifications } = await col();
  const res = await notifications.updateOne({ _id: requireId(params.id), userId: auth!.user._id }, { $set: { readAt: new Date() } });
  if (res.matchedCount === 0) throw notFound();
  return { ok: true };
});
