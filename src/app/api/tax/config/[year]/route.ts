import { applyConfigPatch } from '@/lib/tax/config';
import { TAX_YEARS } from '@/lib/tax/configs';
import { taxConfigPatchSchema } from '@/lib/validation/tax';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';
import { resetTaxConfig, saveTaxConfig, taxConfigFor } from '@/server/services/tax';

function year(raw: string): number {
  const y = Number(raw);
  if (!TAX_YEARS.includes(y)) throw notFound();
  return y;
}

export const GET = api<{ year: string }>('user', async ({ params, auth }) => {
  const { config, edited, updatedAt } = await taxConfigFor(auth!.user._id, year(params.year));
  return { config, edited, updatedAt, disclaimer: 'estimate, not tax advice; confirm with an accountant' };
});

/** Edits the user's copy of a year's rates; `reset` restores the reviewed file. */
export const PUT = api<{ year: string }>('user', async ({ params, body, auth }) => {
  const y = year(params.year);
  const { reset, ...patch } = await body(taxConfigPatchSchema);
  const userId = auth!.user._id;
  if (reset) {
    await resetTaxConfig(userId, y);
    return { ok: true };
  }
  const { config } = await taxConfigFor(userId, y);
  await saveTaxConfig(userId, y, applyConfigPatch(config, patch));
  return { ok: true };
});
