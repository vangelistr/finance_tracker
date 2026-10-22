import 'server-only';
import { col } from '@/server/db/collections';
import { ApiError } from '@/server/http/errors';
import { hitRateLimit } from './rate-limit';

const WINDOW_MS = 15 * 60 * 1000;
export const ACCOUNT_LIMIT = 5;
export const IP_LIMIT = 20;

/** Login, TOTP and registration attempts: 5 per 15 minutes per account and 20 per 15 minutes per client. */
export async function enforceAuthLimits(scope: string, ip: string, account?: string): Promise<void> {
  const { rateLimits } = await col();
  const byIp = await hitRateLimit(rateLimits, `${scope}:ip:${ip}`, IP_LIMIT, WINDOW_MS);
  const byAccount = account ? await hitRateLimit(rateLimits, `${scope}:acct:${account}`, ACCOUNT_LIMIT, WINDOW_MS) : null;
  const blocked = [byIp, byAccount].filter((r) => r && !r.allowed);
  if (blocked.length > 0) {
    const retry = Math.max(...blocked.map((r) => r!.retryAfterSec));
    throw new ApiError(429, 'rate_limited', 'too many attempts', undefined, { 'retry-after': String(retry) });
  }
}

export async function clearAccountLimit(scope: string, account: string): Promise<void> {
  const { rateLimits } = await col();
  await rateLimits.deleteOne({ _id: `${scope}:acct:${account}` });
}
