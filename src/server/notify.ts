import 'server-only';
import { MongoServerError, ObjectId } from 'mongodb';
import { createTranslator } from 'use-intl/core';
import { loadMessages } from '@/i18n/messages';
import type { Collections } from '@/server/db/collections';
import type { UserDoc } from '@/server/db/types';
import { log } from '@/server/log';
import type { PushSender } from '@/server/push/send';

export interface NotifyInput {
  user: Pick<UserDoc, '_id' | 'locale'>;
  key: string; // idempotency key, unique per user (e.g. `backup:<runId>`, `daily:2026-10-22`)
  type: string;
  titleKey: string; // under the `notifications` namespace
  bodyKey: string;
  params?: Record<string, string | number>;
  url: string;
}

export type NotifyResult = 'sent' | 'no_subscription' | 'failed' | 'duplicate';

/**
 * Insert-before-send: the unique (user, key) log row is written first, so a retry or a second worker tick never
 * sends twice; a crash between insert and send loses at most one notification. Every notification also lands in
 * the in-app list (the banner fallback when push is unavailable).
 */
export async function notify(c: Collections, sender: PushSender, input: NotifyInput, now = new Date()): Promise<NotifyResult> {
  const logId = new ObjectId();
  try {
    await c.notificationLog.insertOne({
      _id: logId,
      userId: input.user._id,
      key: input.key,
      type: input.type,
      status: 'sending',
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) return 'duplicate';
    throw err;
  }
  const params = input.params ?? {};
  await c.notifications.insertOne({
    _id: new ObjectId(),
    userId: input.user._id,
    type: input.type,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    params,
    url: input.url,
    createdAt: now,
    readAt: null,
  });
  const t = createTranslator({ locale: input.user.locale, messages: await loadMessages(input.user.locale), namespace: 'notifications' });
  let status: NotifyResult;
  try {
    const res = await sender.sendToUser(input.user._id, {
      title: t(input.titleKey as never, params as never),
      body: t(input.bodyKey as never, params as never),
      url: input.url,
      tag: input.type,
    });
    status = res.subscriptions === 0 ? 'no_subscription' : res.sent > 0 ? 'sent' : 'failed';
  } catch (err) {
    status = 'failed';
    log.warn('push delivery failed', { type: input.type, err: err instanceof Error ? err.name : 'error' });
  }
  await c.notificationLog.updateOne({ _id: logId }, { $set: { status, updatedAt: new Date() } });
  return status;
}
