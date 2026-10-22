import { loginSchema } from '@/lib/validation/auth';
import { clearAccountLimit, enforceAuthLimits } from '@/server/auth/limits';
import { createSession } from '@/server/auth/sessions';
import { authenticate, normalizeEmail } from '@/server/auth/users';
import { api, clientIp } from '@/server/http/api';
import { ApiError } from '@/server/http/errors';

export const POST = api('public', async ({ req, body, sessionCookie }) => {
  const { email, password } = await body(loginSchema);
  const account = normalizeEmail(email);
  await enforceAuthLimits('login', clientIp(req), account);
  const user = await authenticate(account, password);
  if (!user) throw new ApiError(401, 'unauthorized', 'invalid email or password');
  await clearAccountLimit('login', account);
  const mfa = user.totp.enabled;
  const { token, expiresAt } = await createSession(user._id, { mfaPending: mfa });
  sessionCookie.set(token, expiresAt);
  return { ok: true, mfa };
});
