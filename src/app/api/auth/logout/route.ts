import { sessionCookieName } from '@/lib/cookie-names';
import { deleteSession } from '@/server/auth/sessions';
import { isHttps } from '@/server/env';
import { api } from '@/server/http/api';

export const POST = api('public', async ({ req, sessionCookie }) => {
  const token = req.cookies.get(sessionCookieName(isHttps()))?.value;
  if (token) await deleteSession(token);
  sessionCookie.clear();
  return { ok: true };
});
