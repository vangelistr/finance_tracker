import 'server-only';
import { hash, verify, type Options } from '@node-rs/argon2';

// argon2id at the OWASP Password Storage Cheat Sheet minimum: 19 MiB memory, 2 iterations, parallelism 1.
const OPTIONS: Options = {
  algorithm: 2 as unknown as Options['algorithm'], // Algorithm.Argon2id (const enum, not importable with isolatedModules)
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;

/** Spends the same time as a real check when the account does not exist. */
export async function verifyDummy(password: string): Promise<false> {
  dummy ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummy, password);
  return false;
}
