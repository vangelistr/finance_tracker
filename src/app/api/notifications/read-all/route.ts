import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';

export const POST = api('user', async ({ auth }) => {
  const { notifications } = await col();
  await notifications.updateMany({ userId: auth!.user._id, readAt: null }, { $set: { readAt: new Date() } });
  return { ok: true };
});
