import { totpCodeSchema } from '@/lib/validation/auth';
import { decrypt } from '@/server/auth/crypto';
import { enforceAuthLimits } from '@/server/auth/limits';
import { deleteUserSessions } from '@/server/auth/sessions';
import { verifyTotp } from '@/server/auth/totp';
import { col } from '@/server/db/collections';
import { api, clientIp } from '@/server/http/api';
import { ApiError } from '@/server/http/errors';

export const POST = api('user', async ({ req, body, auth }) => {
  const { user, token } = auth!;
  await enforceAuthLimits('totp-enable', clientIp(req), user._id.toHexString());
  const { code } = await body(totpCodeSchema);
  if (user.totp.enabled) throw new ApiError(409, 'conflict', 'second factor already enabled');
  if (!user.totp.pendingSecretEnc) throw new ApiError(400, 'bad_request', 'start enrolment first');
  const result = verifyTotp(decrypt(user.totp.pendingSecretEnc), code, undefined);
  if (!result.ok) throw new ApiError(400, 'validation', 'invalid code', { code: 'invalid' });
  const { users } = await col();
  await users.updateOne(
    { _id: user._id },
    {
      $set: { 'totp.enabled': true, 'totp.secretEnc': user.totp.pendingSecretEnc, 'totp.lastStep': result.step, updatedAt: new Date() },
      $unset: { 'totp.pendingSecretEnc': '' },
    },
  );
  await deleteUserSessions(user._id, token);
  return { ok: true };
});
