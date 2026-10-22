import 'server-only';
import type { Collection } from 'mongodb';
import type { RateLimitDoc } from '@/server/db/types';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Fixed-window counter stored in Mongo (TTL index cleans up). One atomic update per hit. */
export async function hitRateLimit(
  rateLimits: Collection<RateLimitDoc>,
  key: string,
  limit: number,
  windowMs: number,
  now = new Date(),
): Promise<RateLimitResult> {
  const fresh = new Date(now.getTime() + windowMs);
  const active = { $gt: ['$expiresAt', now] };
  const doc = await rateLimits.findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          count: { $cond: [active, { $add: ['$count', 1] }, 1] },
          expiresAt: { $cond: [active, '$expiresAt', fresh] },
        },
      },
    ],
    { upsert: true, returnDocument: 'after' },
  );
  const count = doc?.count ?? 1;
  const expiresAt = doc?.expiresAt ?? fresh;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSec: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

export async function resetRateLimit(rateLimits: Collection<RateLimitDoc>, key: string): Promise<void> {
  await rateLimits.deleteOne({ _id: key });
}
