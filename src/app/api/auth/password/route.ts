import { changePasswordSchema } from '@/lib/validation/auth';
import { enforceAuthLimits } from '@/server/auth/limits';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { createSession, deleteUserSessions } from '@/server/auth/sessions';
import { col } from '@/server/db/collections';
import { api, clientIp } from '@/server/http/api';
import { ApiError } from '@/server/http/errors';

export const POST = api('user', async ({ req, body, auth, sessionCookie }) => {
  const { user } = auth!;
  await enforceAuthLimits('password', clientIp(req), user._id.toHexString());
  const { current, next } = await body(changePasswordSchema);
  if (!(await verifyPassword(user.passwordHash, current))) {
    throw new ApiError(400, 'validation', 'current password is wrong', { current: 'wrong' });
  }
  const now = new Date();
  const { users } = await col();
  await users.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(next), passwordChangedAt: now, updatedAt: now } },
  );
  // Sign out every session, then start a fresh one for this device.
  await deleteUserSessions(user._id);
  const { token, expiresAt } = await createSession(user._id);
  sessionCookie.set(token, expiresAt);
  return { ok: true };
});
