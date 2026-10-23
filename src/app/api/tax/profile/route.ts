import { taxProfileSchema } from '@/lib/validation/tax';
import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';
import { taxProfile } from '@/server/services/tax';

export const GET = api('user', async ({ auth }) => ({ profile: taxProfile(auth!.user) }));

/** Partial update; null is a real value for the optional fields (no class, no minimum, standard VAT rate). */
export const PUT = api('user', async ({ body, auth }) => {
  const input = await body(taxProfileSchema);
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(input)) if (v !== undefined) set[`settings.tax.${k}`] = v;
  const { users } = await col();
  await users.updateOne({ _id: auth!.user._id }, { $set: set });
  return { ok: true };
});
