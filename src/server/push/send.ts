import 'server-only';
import type { ObjectId } from 'mongodb';
import webpush from 'web-push';
import { col } from '@/server/db/collections';
import { env, pushConfigured } from '@/server/env';
import { log } from '@/server/log';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export interface PushSender {
  sendToUser(userId: ObjectId, payload: PushPayload): Promise<{ sent: number; failed: number; subscriptions: number }>;
}

let configured = false;

function configure(): boolean {
  if (!pushConfigured()) return false;
  if (!configured) {
    const e = env();
    webpush.setVapidDetails(e.VAPID_SUBJECT!, e.VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return true;
}

/** Sends one payload to every subscription of a user. Gone subscriptions (404/410) are deleted. */
export const webPushSender: PushSender = {
  async sendToUser(userId, payload) {
    const { pushSubscriptions } = await col();
    const subs = await pushSubscriptions.find({ userId }).toArray();
    if (subs.length === 0 || !configure()) return { sent: 0, failed: 0, subscriptions: subs.length };
    let sent = 0;
    let failed = 0;
    const body = JSON.stringify(payload);
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, { TTL: 60 * 60 * 12, urgency: 'normal' });
        sent++;
        await pushSubscriptions.updateOne({ _id: sub._id }, { $set: { lastSuccessAt: new Date(), failureCount: 0 } });
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await pushSubscriptions.deleteOne({ _id: sub._id });
        } else {
          await pushSubscriptions.updateOne({ _id: sub._id }, { $inc: { failureCount: 1 } });
          log.warn('push send failed', { status });
        }
      }
    }
    return { sent, failed, subscriptions: subs.length };
  },
};
