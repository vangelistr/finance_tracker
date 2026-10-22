import { z } from 'zod';
import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const DELETE = api<{ id: string }>('owner', async ({ params, auth }) => {
  const id = idSchema.safeParse(params.id);
  if (!id.success) throw notFound();
  const { invites } = await col();
  const res = await invites.deleteOne({ _id: id.data, createdBy: auth!.user._id, usedAt: null });
  if (res.deletedCount !== 1) throw notFound();
  return { ok: true };
});
