'use client';

import type { ApiFailure } from '@/lib/client/api';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Maps an API failure to a user-facing message from the `auth.errors` namespace. */
export function authErrorMessage(t: Translate, failure: ApiFailure, fallback = 'generic'): string {
  if (failure.code === 'network') return t('network');
  if (failure.code === 'rate_limited') return t('rateLimited', { minutes: Math.max(1, Math.ceil((failure.retryAfter ?? 60) / 60)) });
  return t(fallback);
}
