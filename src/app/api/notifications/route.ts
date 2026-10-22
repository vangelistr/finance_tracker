import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';

export const GET = api('user', async ({ auth }) => {
  const { notifications } = await col();
  const list = await notifications.find({ userId: auth!.user._id }).sort({ createdAt: -1 }).limit(30).toArray();
  return {
    notifications: list.map((n) => ({
      id: n._id.toHexString(),
      type: n.type,
      titleKey: n.titleKey,
      bodyKey: n.bodyKey,
      params: n.params,
      url: n.url,
      createdAt: n.createdAt,
      read: n.readAt !== null,
    })),
  };
});
