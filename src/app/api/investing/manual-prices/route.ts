import { manualPriceSchema } from '@/lib/validation/investing';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';
import { requireId } from '@/server/services/ids';
import { assertInvesting, setManualPrice } from '@/server/services/investing';

export const POST = api('user', async ({ body, auth }) => {
  const { user } = auth!;
  assertInvesting(user);
  const input = await body(manualPriceSchema);
  const w = await setManualPrice(user._id, requireId(input.watchlistId), input.localDate, input.priceMicros);
  if (!w) throw notFound();
  return { ok: true };
});
