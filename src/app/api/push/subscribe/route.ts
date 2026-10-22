import { pushSubscriptionSchema } from '@/lib/validation/push';
import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';

export const POST = api('user', async ({ req, body, auth }) => {
  const { endpoint, keys } = await body(pushSubscriptionSchema);
  const { pushSubscriptions } = await col();
  const userId = auth!.user._id;
  // An endpoint belongs to one browser profile; re-subscribing moves it to the signed-in user.
  await pushSubscriptions.updateOne(
    { endpoint },
    {
      $set: { userId, keys, userAgent: (req.headers.get('user-agent') ?? '').slice(0, 200), failureCount: 0 },
      $setOnInsert: { createdAt: new Date(), lastSuccessAt: null },
    },
    { upsert: true },
  );
  return { ok: true };
});
