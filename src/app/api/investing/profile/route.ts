import { investingProfileSchema } from '@/lib/validation/investing';
import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';
import { assertInvesting } from '@/server/services/investing';

/** Questionnaire answers, profile override, ranking weights and guardrails; null restores a default, reset all. */
export const PUT = api('user', async ({ body, auth }) => {
  const { user } = auth!;
  assertInvesting(user);
  const { reset, ...input } = await body(investingProfileSchema);
  const { users } = await col();
  const keys = ['answers', 'profileOverride', 'weights', 'guardrails'] as const;
  if (reset) {
    await users.updateOne({ _id: user._id }, { $unset: Object.fromEntries(keys.map((k) => [`settings.investing.${k}`, ''])), $set: { updatedAt: new Date() } });
    return { ok: true };
  }
  const set: Record<string, unknown> = { updatedAt: new Date() };
  const unset: Record<string, ''> = {};
  for (const k of keys) {
    const v = input[k];
    if (v === undefined) continue;
    if (v === null) unset[`settings.investing.${k}`] = '';
    else set[`settings.investing.${k}`] = v;
  }
  await users.updateOne({ _id: user._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  return { ok: true };
});
