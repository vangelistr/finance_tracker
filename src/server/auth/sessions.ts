import 'server-only';
import type { ObjectId } from 'mongodb';
import { col } from '@/server/db/collections';
import type { SessionDoc, UserDoc } from '@/server/db/types';
import { randomToken, tokenId } from './crypto';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MFA_PENDING_TTL_MS = 10 * 60 * 1000;
const TOUCH_AFTER_MS = 60 * 60 * 1000;

export interface ActiveSession {
  token: string;
  session: SessionDoc;
  user: UserDoc;
}

export async function createSession(
  userId: ObjectId,
  opts: { mfaPending?: boolean; now?: Date } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const now = opts.now ?? new Date();
  const token = randomToken(32);
  const expiresAt = new Date(now.getTime() + (opts.mfaPending ? MFA_PENDING_TTL_MS : SESSION_TTL_MS));
  const { sessions } = await col();
  await sessions.insertOne({
    _id: tokenId(token),
    userId,
    mfaPending: !!opts.mfaPending,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });
  return { token, expiresAt };
}

/** Resolves a session token to its session and user. Extends the sliding expiry at most once an hour. */
export async function findSession(token: string | undefined, now = new Date()): Promise<ActiveSession | null> {
  if (!token || token.length > 100) return null;
  const { sessions, users } = await col();
  const id = tokenId(token);
  const session = await sessions.findOne({ _id: id });
  if (!session || session.expiresAt <= now) return null;
  const user = await users.findOne({ _id: session.userId });
  if (!user) return null;
  if (!session.mfaPending && now.getTime() - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await sessions.updateOne({ _id: id }, { $set: { lastSeenAt: now, expiresAt } });
    session.lastSeenAt = now;
    session.expiresAt = expiresAt;
  }
  return { token, session, user };
}

export async function deleteSession(token: string): Promise<void> {
  const { sessions } = await col();
  await sessions.deleteOne({ _id: tokenId(token) });
}

export async function deleteUserSessions(userId: ObjectId, exceptToken?: string): Promise<void> {
  const { sessions } = await col();
  const filter = exceptToken ? { userId, _id: { $ne: tokenId(exceptToken) } } : { userId };
  await sessions.deleteMany(filter);
}
