import { pushUnsubscribeSchema } from '@/lib/validation/push';
import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';

export const POST = api('user', async ({ body, auth }) => {
  const { endpoint } = await body(pushUnsubscribeSchema);
  const { pushSubscriptions } = await col();
  await pushSubscriptions.deleteOne({ endpoint, userId: auth!.user._id });
  return { ok: true };
});
