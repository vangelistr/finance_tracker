import 'server-only';
import type { ObjectId } from 'mongodb';
import { col } from '@/server/db/collections';

/** Unread in-app notifications from the last two weeks, newest first (the banner shows up to three). */
export async function recentUnread(userId: ObjectId, now = new Date(), limit = 3) {
  const { notifications } = await col();
  const since = new Date(now.getTime() - 14 * 86_400_000);
  const list = await notifications.find({ userId, readAt: null, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(limit).toArray();
  return list.map((n) => ({ id: n._id.toHexString(), titleKey: n.titleKey, bodyKey: n.bodyKey, params: n.params, url: n.url }));
}
