import { registerSchema } from '@/lib/validation/auth';
import { tokenId } from '@/server/auth/crypto';
import { enforceAuthLimits } from '@/server/auth/limits';
import { createSession } from '@/server/auth/sessions';
import { createMember, EmailTakenError } from '@/server/auth/users';
import { col } from '@/server/db/collections';
import { DEFAULT_TIMEZONE } from '@/lib/dates';
import { api, clientIp } from '@/server/http/api';
import { ApiError } from '@/server/http/errors';

export const POST = api('public', async ({ req, body, sessionCookie }) => {
  await enforceAuthLimits('register', clientIp(req));
  const input = await body(registerSchema);
  const { invites } = await col();
  const now = new Date();
  // Claim the invite first, so one invite can create at most one account.
  const invite = await invites.findOneAndUpdate(
    { _id: tokenId(input.token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  );
  if (!invite) throw new ApiError(400, 'bad_request', 'invalid or expired invite');
  try {
    const user = await createMember({
      email: input.email,
      name: input.name,
      password: input.password,
      locale: input.locale,
      currency: 'EUR',
      timezone: DEFAULT_TIMEZONE,
      investingEnabled: false,
    });
    await invites.updateOne({ _id: invite._id }, { $set: { usedBy: user._id } });
    const { token, expiresAt } = await createSession(user._id);
    sessionCookie.set(token, expiresAt);
    return { ok: true };
  } catch (err) {
    await invites.updateOne({ _id: invite._id }, { $set: { usedAt: null } });
    if (err instanceof EmailTakenError) throw new ApiError(409, 'conflict', 'email already registered', { email: 'taken' });
    throw err;
  }
});
