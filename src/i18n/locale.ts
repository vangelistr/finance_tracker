import 'server-only';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE } from '@/lib/cookie-names';
import { getCurrentSession } from '@/server/auth/current';
import type { Locale } from '@/server/db/types';

export const DEFAULT_LOCALE: Locale = 'el';

function isLocale(value: string | undefined): value is Locale {
  return value === 'el' || value === 'en';
}

/** Signed-in user's setting, then the locale cookie, then Accept-Language, then Greek. */
export async function resolveLocale(): Promise<Locale> {
  try {
    const current = await getCurrentSession();
    if (current && !current.session.mfaPending) return current.user.locale;
  } catch {
    // Database unavailable: fall through to the cookie so error pages still render.
  }
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accept = (await headers()).get('accept-language') ?? '';
  const first = accept.split(',')[0]?.trim().slice(0, 2).toLowerCase();
  return first === 'en' ? 'en' : DEFAULT_LOCALE;
}
