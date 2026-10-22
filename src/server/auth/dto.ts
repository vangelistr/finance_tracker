import type { UserDoc } from '@/server/db/types';

/** The user fields that may leave the server. Never includes hashes or secrets. */
export function publicUser(user: UserDoc) {
  return {
    id: user._id.toHexString(),
    email: user.email,
    name: user.name,
    role: user.role,
    locale: user.locale,
    currency: user.currency,
    timezone: user.timezone,
    totpEnabled: user.totp.enabled,
    settings: user.settings,
    onboardingDone: user.onboardingDoneAt !== null,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
