import { settingsPatchSchema, settingsPatchToSet } from '@/lib/validation/settings';
import { publicUser } from '@/server/auth/dto';
import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const GET = api('user', async ({ auth }) => ({ user: publicUser(auth!.user) }));

export const PATCH = api('user', async ({ body, auth }) => {
  const patch = await body(settingsPatchSchema);
  const { users } = await col();
  const updated = await users.findOneAndUpdate(
    { _id: auth!.user._id },
    { $set: { ...settingsPatchToSet(patch), updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw notFound();
  return { user: publicUser(updated) };
});
