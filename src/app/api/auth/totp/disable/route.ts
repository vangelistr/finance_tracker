import { disableTotpSchema } from '@/lib/validation/auth';
import { decrypt } from '@/server/auth/crypto';
import { enforceAuthLimits } from '@/server/auth/limits';
import { verifyPassword } from '@/server/auth/password';
import { verifyTotp } from '@/server/auth/totp';
import { col } from '@/server/db/collections';
import { api, clientIp } from '@/server/http/api';
import { ApiError } from '@/server/http/errors';

export const POST = api('user', async ({ req, body, auth }) => {
  const { user } = auth!;
  await enforceAuthLimits('totp-disable', clientIp(req), user._id.toHexString());
  const { password, code } = await body(disableTotpSchema);
  if (!user.totp.enabled || !user.totp.secretEnc) throw new ApiError(400, 'bad_request', 'second factor not enabled');
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new ApiError(400, 'validation', 'wrong password', { password: 'wrong' });
  }
  if (!verifyTotp(decrypt(user.totp.secretEnc), code, user.totp.lastStep).ok) {
    throw new ApiError(400, 'validation', 'invalid code', { code: 'invalid' });
  }
  const { users } = await col();
  await users.updateOne({ _id: user._id }, { $set: { totp: { enabled: false }, updatedAt: new Date() } });
  return { ok: true };
});
