import { createSession } from '@/server/auth/sessions';
import { createMember } from '@/server/auth/users';
import { TestClient } from './client';

let n = 0;

/** A signed-in member created directly through the service layer (no invite flow). */
export async function signedInUser(locale: 'el' | 'en' = 'el') {
  n++;
  const user = await createMember({
    email: `user${n}-${Date.now()}@example.com`,
    name: `User ${n}`,
    password: 'integration-pass-1', // gitleaks:allow (test-only password)
    locale,
    currency: 'EUR',
    timezone: 'Europe/Athens',
    investingEnabled: false,
  });
  const { token } = await createSession(user._id);
  const client = new TestClient();
  client.jar.set('ft_session', token);
  return { user, client };
}
