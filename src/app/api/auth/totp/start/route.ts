import QRCode from 'qrcode';
import { encrypt } from '@/server/auth/crypto';
import { newTotpSecret, totpUri } from '@/server/auth/totp';
import { col } from '@/server/db/collections';
import { api } from '@/server/http/api';
import { ApiError } from '@/server/http/errors';

export const POST = api('user', async ({ auth }) => {
  const { user } = auth!;
  if (user.totp.enabled) throw new ApiError(409, 'conflict', 'second factor already enabled');
  const secret = newTotpSecret();
  const { users } = await col();
  await users.updateOne({ _id: user._id }, { $set: { 'totp.pendingSecretEnc': encrypt(secret), updatedAt: new Date() } });
  const uri = totpUri(secret, user.email);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
  return { secret, uri, qr };
});
