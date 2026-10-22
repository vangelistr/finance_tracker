import { planSettingsSchema } from '@/lib/validation/goals';
import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';

export const PUT = api('user', async ({ body, auth }) => {
  const { reset, ...input } = await body(planSettingsSchema);
  const { users } = await col();
  const userId = auth!.user._id;
  if (reset) {
    await users.updateOne({ _id: userId }, { $unset: { 'settings.plan': '' }, $set: { updatedAt: new Date() } });
    return { ok: true };
  }
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (v === null) unset[`settings.plan.${k}`] = '';
    else set[`settings.plan.${k}`] = v;
  }
  await users.updateOne({ _id: userId }, { $set: { ...set, updatedAt: new Date() }, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  return { ok: true };
});
