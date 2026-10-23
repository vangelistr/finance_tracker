import 'server-only';
import { notFound } from 'next/navigation';
import { ensureStarter } from '@/server/services/investing';
import { requireUser } from './current';

/**
 * For investing pages: 404 while the module is off, and the starter watchlist in place before anything reads it.
 * Each page calls it itself because Next.js renders a layout and its page concurrently.
 */
export async function requireInvestingUser() {
  const current = await requireUser();
  if (!current.user.settings.investingEnabled) notFound();
  await ensureStarter(current.user);
  return current;
}
