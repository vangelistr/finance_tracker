import 'server-only';
import { Secret, TOTP } from 'otpauth';

// RFC 6238: SHA-1, 6 digits, 30-second steps, ±1 step tolerance, replay blocked by the last used step.

const PERIOD = 30;

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function totpUri(secretBase32: string, label: string): string {
  return new TOTP({
    issuer: 'Finance Tracker',
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32),
  }).toString();
}

export function verifyTotp(
  secretBase32: string,
  token: string,
  lastStep: number | undefined,
  now = Date.now(),
): { ok: true; step: number } | { ok: false } {
  if (!/^\d{6}$/.test(token)) return { ok: false };
  const delta = TOTP.validate({
    token,
    secret: Secret.fromBase32(secretBase32),
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD,
    timestamp: now,
    window: 1,
  });
  if (delta === null) return { ok: false };
  const step = TOTP.counter({ period: PERIOD, timestamp: now }) + delta;
  if (lastStep !== undefined && step <= lastStep) return { ok: false };
  return { ok: true, step };
}
