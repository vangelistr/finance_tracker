import { setupSchema } from '@/lib/validation/auth';
import { enforceAuthLimits } from '@/server/auth/limits';
import { createSession } from '@/server/auth/sessions';
import { createOwner, isSetupComplete, SetupAlreadyDoneError } from '@/server/auth/users';
import { api, clientIp } from '@/server/http/api';
import { ApiError } from '@/server/http/errors';

export const POST = api('public', async ({ req, body, sessionCookie }) => {
  if (await isSetupComplete()) throw new ApiError(409, 'conflict', 'setup already completed');
  await enforceAuthLimits('setup', clientIp(req));
  const input = await body(setupSchema);
  try {
    const user = await createOwner(input);
    const { token, expiresAt } = await createSession(user._id);
    sessionCookie.set(token, expiresAt);
    return { ok: true };
  } catch (err) {
    if (err instanceof SetupAlreadyDoneError) throw new ApiError(409, 'conflict', 'setup already completed');
    throw err;
  }
});
