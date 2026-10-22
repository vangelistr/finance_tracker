import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { sessionCookieName } from '@/lib/cookie-names';
import { isHttps } from '@/server/env';
import { findSession, type ActiveSession } from './sessions';
import { isSetupComplete } from './users';

/** The session of the current request (memoised per render). */
export const getCurrentSession = cache(async (): Promise<ActiveSession | null> => {
  const token = (await cookies()).get(sessionCookieName(isHttps()))?.value;
  return findSession(token);
});

/** For pages behind auth: sends visitors to setup, login or the second-factor step as needed. */
export async function requireUser(): Promise<ActiveSession> {
  if (!(await isSetupComplete())) redirect('/setup');
  const current = await getCurrentSession();
  if (!current) redirect('/login');
  if (current.session.mfaPending) redirect('/login/2fa');
  return current;
}

export async function requireOwner(): Promise<ActiveSession> {
  const current = await requireUser();
  if (current.user.role !== 'owner') redirect('/');
  return current;
}
