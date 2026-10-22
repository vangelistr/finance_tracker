import { Secret, TOTP } from 'otpauth';
import { beforeAll, describe, expect, it } from 'vitest';
import * as invites from '@/app/api/invites/route';
import * as inviteById from '@/app/api/invites/[id]/route';
import * as login from '@/app/api/auth/login/route';
import * as loginTotp from '@/app/api/auth/login/totp/route';
import * as logout from '@/app/api/auth/logout/route';
import * as password from '@/app/api/auth/password/route';
import * as register from '@/app/api/auth/register/route';
import * as setup from '@/app/api/auth/setup/route';
import * as totpEnable from '@/app/api/auth/totp/enable/route';
import * as totpStart from '@/app/api/auth/totp/start/route';
import * as settings from '@/app/api/settings/route';
import * as pushSubscribe from '@/app/api/push/subscribe/route';
import * as pushUnsubscribe from '@/app/api/push/unsubscribe/route';
import { getDb } from '@/server/db/client';
import { collectionsOf } from '@/server/db/collections';
import { runMigrations } from '@/server/db/migrations';
import { isSetupComplete } from '@/server/auth/users';
import { TestClient } from './client';

const OWNER = {
  email: 'Owner@Example.com',
  name: 'Owner',
  password: 'correct-horse-battery',
  locale: 'el',
  currency: 'EUR',
  timezone: 'Europe/Athens',
  investingEnabled: false,
};

beforeAll(async () => {
  await runMigrations(await getDb());
});

describe('first run, setup and closed registration', () => {
  const owner = new TestClient();

  it('starts with no setup and an unauthenticated API', async () => {
    expect(await isSetupComplete()).toBe(false);
    const res = await owner.call(settings.GET, 'GET', '/api/settings');
    expect(res.status).toBe(401);
  });

  it('creates exactly one owner, then refuses a second setup', async () => {
    const a = new TestClient();
    const b = new TestClient();
    const [ra, rb] = await Promise.all([
      a.call(setup.POST, 'POST', '/api/auth/setup', { body: OWNER, ip: '10.0.1.1' }),
      b.call(setup.POST, 'POST', '/api/auth/setup', { body: { ...OWNER, email: 'other@example.com' }, ip: '10.0.1.2' }),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    const { users } = collectionsOf(await getDb());
    expect(await users.countDocuments({ role: 'owner' })).toBe(1);
    expect(await isSetupComplete()).toBe(true);
    const again = await owner.call(setup.POST, 'POST', '/api/auth/setup', { body: OWNER, ip: '10.0.1.3' });
    expect(again.status).toBe(409);
  });

  it('logs the owner in with a normalised email and never returns secrets', async () => {
    const { users } = collectionsOf(await getDb());
    const ownerDoc = await users.findOne({ role: 'owner' });
    const email = ownerDoc!.email;
    const res = await owner.call(login.POST, 'POST', '/api/auth/login', { body: { email: email.toUpperCase(), password: OWNER.password } });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, mfa: false });
    expect(owner.sessionToken).toBeTruthy();
    const me = await owner.call(settings.GET, 'GET', '/api/settings');
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.json)).not.toMatch(/passwordHash|secretEnc|argon2/);
  });

  it('stores only a keyed hash of the session token', async () => {
    const { sessions } = collectionsOf(await getDb());
    expect(await sessions.countDocuments({ _id: owner.sessionToken! })).toBe(0);
    expect(await sessions.countDocuments({})).toBeGreaterThan(0);
  });
});

describe('CSRF defence', () => {
  it('rejects unsafe requests without a matching Origin or token', async () => {
    const c = new TestClient();
    const body = { email: 'x@example.com', password: 'whatever-password' };
    expect((await c.call(login.POST, 'POST', '/api/auth/login', { body, origin: null })).status).toBe(403);
    expect((await c.call(login.POST, 'POST', '/api/auth/login', { body, origin: 'https://evil.example' })).status).toBe(403);
    expect((await c.call(login.POST, 'POST', '/api/auth/login', { body, csrf: null })).status).toBe(403);
    expect((await c.call(login.POST, 'POST', '/api/auth/login', { body, csrf: 'different-token-value' })).status).toBe(403);
  });
});

describe('login rate limiting', () => {
  it('blocks the sixth wrong password for one account within the window', async () => {
    const c = new TestClient();
    const body = { email: 'nobody-here@example.com', password: 'wrong-password-123' };
    for (let i = 0; i < 5; i++) {
      expect((await c.call(login.POST, 'POST', '/api/auth/login', { body, ip: `10.0.2.${i}` })).status).toBe(401);
    }
    const blocked = await c.call(login.POST, 'POST', '/api/auth/login', { body, ip: '10.0.2.9' });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('rejects malformed bodies with a validation error', async () => {
    const c = new TestClient();
    const res = await c.call(login.POST, 'POST', '/api/auth/login', { body: { email: 'a@b.c', password: 'x', admin: true }, ip: '10.0.3.1' });
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('validation');
  });
});

describe('invites, members and isolation', () => {
  const owner = new TestClient();
  const member = new TestClient();
  let inviteUrl = '';
  let inviteId = '';

  beforeAll(async () => {
    const { users } = collectionsOf(await getDb());
    const email = (await users.findOne({ role: 'owner' }))!.email;
    await owner.call(login.POST, 'POST', '/api/auth/login', { body: { email, password: OWNER.password }, ip: '10.0.4.1' });
  });

  it('lets the owner create an invite that works once', async () => {
    const res = await owner.call(invites.POST, 'POST', '/api/invites', { body: { note: 'partner' } });
    expect(res.status).toBe(200);
    inviteUrl = res.json.url;
    inviteId = res.json.id;
    const token = inviteUrl.split('/invite/')[1]!;
    const body = { token, email: 'member@example.com', name: 'Member', password: 'member-password-1', locale: 'en' };
    expect((await member.call(register.POST, 'POST', '/api/auth/register', { body, ip: '10.0.4.2' })).status).toBe(200);
    const again = new TestClient();
    const reuse = await again.call(register.POST, 'POST', '/api/auth/register', { body: { ...body, email: 'second@example.com' }, ip: '10.0.4.3' });
    expect(reuse.status).toBe(400);
    const me = await member.call(settings.GET, 'GET', '/api/settings');
    expect(me.json.user.role).toBe('member');
  });

  it('keeps invites and settings to their owner', async () => {
    expect((await member.call(invites.POST, 'POST', '/api/invites', { body: { note: 'x' } })).status).toBe(403);
    expect((await member.call(invites.GET, 'GET', '/api/invites')).status).toBe(403);
    expect((await member.call(inviteById.DELETE, 'DELETE', `/api/invites/${inviteId}`, { params: { id: inviteId } })).status).toBe(403);

    await member.call(settings.PATCH, 'PATCH', '/api/settings', { body: { theme: 'dark', name: 'Changed' } });
    const ownerView = await owner.call(settings.GET, 'GET', '/api/settings');
    expect(ownerView.json.user.settings.theme).toBe('system');
    expect(ownerView.json.user.name).toBe('Owner');
  });

  it('never lets one user remove another user’s push subscription', async () => {
    const sub = { endpoint: 'https://push.example.com/owner-device', keys: { p256dh: 'p'.repeat(40), auth: 'a'.repeat(16) } };
    expect((await owner.call(pushSubscribe.POST, 'POST', '/api/push/subscribe', { body: sub })).status).toBe(200);
    await member.call(pushUnsubscribe.POST, 'POST', '/api/push/unsubscribe', { body: { endpoint: sub.endpoint } });
    const { pushSubscriptions, users } = collectionsOf(await getDb());
    const ownerId = (await users.findOne({ role: 'owner' }))!._id;
    expect(await pushSubscriptions.countDocuments({ endpoint: sub.endpoint, userId: ownerId })).toBe(1);
  });
});

describe('two-step verification', () => {
  const user = new TestClient();
  let secret = '';

  beforeAll(async () => {
    const { users } = collectionsOf(await getDb());
    const email = (await users.findOne({ role: 'owner' }))!.email;
    await user.call(login.POST, 'POST', '/api/auth/login', { body: { email, password: OWNER.password }, ip: '10.0.5.1' });
  });

  const code = (offsetSteps = 0) =>
    TOTP.generate({ secret: Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6, period: 30, timestamp: Date.now() + offsetSteps * 30_000 });

  it('enrols with a valid code only', async () => {
    const start = await user.call(totpStart.POST, 'POST', '/api/auth/totp/start');
    expect(start.status).toBe(200);
    secret = start.json.secret;
    expect((await user.call(totpEnable.POST, 'POST', '/api/auth/totp/enable', { body: { code: '000000' } })).status).toBe(400);
    expect((await user.call(totpEnable.POST, 'POST', '/api/auth/totp/enable', { body: { code: code() } })).status).toBe(200);
  });

  it('requires the second factor at sign-in and blocks code replay', async () => {
    const { users } = collectionsOf(await getDb());
    const email = (await users.findOne({ role: 'owner' }))!.email;
    const c = new TestClient();
    const first = await c.call(login.POST, 'POST', '/api/auth/login', { body: { email, password: OWNER.password }, ip: '10.0.5.2' });
    expect(first.json).toEqual({ ok: true, mfa: true });
    expect((await c.call(settings.GET, 'GET', '/api/settings')).status).toBe(401);

    const next = code(1);
    const ok = await c.call(loginTotp.POST, 'POST', '/api/auth/login/totp', { body: { code: next }, ip: '10.0.5.2' });
    expect(ok.status).toBe(200);
    expect((await c.call(settings.GET, 'GET', '/api/settings')).status).toBe(200);

    const d = new TestClient();
    await d.call(login.POST, 'POST', '/api/auth/login', { body: { email, password: OWNER.password }, ip: '10.0.5.3' });
    const replay = await d.call(loginTotp.POST, 'POST', '/api/auth/login/totp', { body: { code: next }, ip: '10.0.5.3' });
    expect(replay.status).toBe(400);
  });
});

describe('password change and logout', () => {
  it('signs out other sessions on password change, and logout ends the session', async () => {
    const email = 'member@example.com';
    const a = new TestClient();
    const b = new TestClient();
    await a.call(login.POST, 'POST', '/api/auth/login', { body: { email, password: 'member-password-1' }, ip: '10.0.6.1' });
    await b.call(login.POST, 'POST', '/api/auth/login', { body: { email, password: 'member-password-1' }, ip: '10.0.6.2' });
    const changed = await a.call(password.POST, 'POST', '/api/auth/password', { body: { current: 'member-password-1', next: 'member-password-2' } });
    expect(changed.status).toBe(200);
    expect((await b.call(settings.GET, 'GET', '/api/settings')).status).toBe(401);
    expect((await a.call(settings.GET, 'GET', '/api/settings')).status).toBe(200);
    await a.call(logout.POST, 'POST', '/api/auth/logout');
    expect((await a.call(settings.GET, 'GET', '/api/settings')).status).toBe(401);
  });
});
