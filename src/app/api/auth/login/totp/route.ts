import { totpCodeSchema } from '@/lib/validation/auth';
import { decrypt } from '@/server/auth/crypto';
import { clearAccountLimit, enforceAuthLimits } from '@/server/auth/limits';
import { createSession, deleteSession } from '@/server/auth/sessions';
import { verifyTotp } from '@/server/auth/totp';
import { col } from '@/server/db/collections';
import { api, clientIp } from '@/server/http/api';
import { ApiError } from '@/server/http/errors';

export const POST = api('mfa', async ({ req, body, auth, sessionCookie }) => {
  const { user, token: pendingToken } = auth!;
  const account = user._id.toHexString();
  await enforceAuthLimits('totp', clientIp(req), account);
  const { code } = await body(totpCodeSchema);
  if (!user.totp.enabled || !user.totp.secretEnc) throw new ApiError(400, 'bad_request', 'second factor not enabled');
  const result = verifyTotp(decrypt(user.totp.secretEnc), code, user.totp.lastStep);
  if (!result.ok) throw new ApiError(400, 'validation', 'invalid code', { code: 'invalid' });
  const { users } = await col();
  // Conditional update: a concurrent request with the same code cannot pass the replay check twice.
  const updated = await users.updateOne(
    { _id: user._id, $or: [{ 'totp.lastStep': { $exists: false } }, { 'totp.lastStep': { $lt: result.step } }] },
    { $set: { 'totp.lastStep': result.step } },
  );
  if (updated.modifiedCount !== 1) throw new ApiError(400, 'validation', 'invalid code', { code: 'invalid' });
  await clearAccountLimit('totp', account);
  await deleteSession(pendingToken);
  const { token, expiresAt } = await createSession(user._id);
  sessionCookie.set(token, expiresAt);
  return { ok: true };
});
