import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';

export const POST = api('user', async ({ auth }) => {
  const { users } = await col();
  const now = new Date();
  await users.updateOne({ _id: auth!.user._id, onboardingDoneAt: null }, { $set: { onboardingDoneAt: now, updatedAt: now } });
  return { ok: true };
});
