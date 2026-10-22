import 'server-only';
import { cookies } from 'next/headers';
import { THEME_COOKIE } from '@/lib/cookie-names';
import { getCurrentSession } from '@/server/auth/current';
import type { Theme } from '@/server/db/types';

/** The signed-in user's theme, else the theme cookie, else the device setting. */
export async function resolveTheme(): Promise<Theme> {
  try {
    const current = await getCurrentSession();
    if (current && !current.session.mfaPending) return current.user.settings.theme;
  } catch {
    // Database unavailable: use the cookie.
  }
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === 'light' || value === 'dark' ? value : 'system';
}
