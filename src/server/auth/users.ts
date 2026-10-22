import 'server-only';
import { MongoServerError, ObjectId } from 'mongodb';
import { DEFAULT_TIMEZONE } from '@/lib/dates';
import { col } from '@/server/db/collections';
import type { Locale, Role, UserDoc, UserSettings } from '@/server/db/types';
import { seedCategories } from '@/server/services/categories';
import { hashPassword, verifyDummy, verifyPassword } from './password';

export function defaultSettings(investingEnabled = false): UserSettings {
  return {
    investingEnabled,
    theme: 'system',
    notifications: {
      daily: { enabled: true, time: '21:00' },
      monthly: { enabled: true, time: '09:00' },
      renewals: { enabled: true, defaultDaysBefore: 3 },
      overspend: { enabled: true, thresholds: [80, 100] },
      marketDigest: { enabled: false },
      backup: { enabled: true },
    },
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isSetupComplete(): Promise<boolean> {
  const { appMeta } = await col();
  return (await appMeta.countDocuments({ _id: 'setup' }, { limit: 1 })) > 0;
}

export class SetupAlreadyDoneError extends Error {}
export class EmailTakenError extends Error {}

interface NewUserInput {
  email: string;
  name: string;
  password: string;
  locale: Locale;
  currency: string;
  timezone: string;
  investingEnabled: boolean;
}

function buildUser(input: NewUserInput, role: Role, passwordHash: string, now: Date, id = new ObjectId()): UserDoc {
  return {
    _id: id,
    email: normalizeEmail(input.email),
    name: input.name.trim(),
    passwordHash,
    role,
    locale: input.locale,
    currency: input.currency,
    timezone: input.timezone || DEFAULT_TIMEZONE,
    totp: { enabled: false },
    settings: defaultSettings(input.investingEnabled),
    onboardingDoneAt: null,
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates the owner account. The `app_meta.setup` marker is inserted first: its unique `_id` makes the
 * first request win, so two concurrent setups can never create two owners.
 */
export async function createOwner(input: NewUserInput, now = new Date()): Promise<UserDoc> {
  const { appMeta, users } = await col();
  const passwordHash = await hashPassword(input.password);
  const ownerId = new ObjectId();
  try {
    await appMeta.insertOne({ _id: 'setup', completedAt: now, ownerId });
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) throw new SetupAlreadyDoneError();
    throw err;
  }
  const user = buildUser(input, 'owner', passwordHash, now, ownerId);
  try {
    await users.insertOne(user);
  } catch (err) {
    await appMeta.deleteOne({ _id: 'setup' });
    throw err;
  }
  await seedCategories(user._id, user.locale, now);
  return user;
}

export async function createMember(input: NewUserInput, now = new Date()): Promise<UserDoc> {
  const { users } = await col();
  const user = buildUser(input, 'member', await hashPassword(input.password), now);
  try {
    await users.insertOne(user);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) throw new EmailTakenError();
    throw err;
  }
  await seedCategories(user._id, user.locale, now);
  return user;
}

export async function authenticate(email: string, password: string): Promise<UserDoc | null> {
  const { users } = await col();
  const user = await users.findOne({ email: normalizeEmail(email) });
  if (!user) return verifyDummy(password).then(() => null);
  return (await verifyPassword(user.passwordHash, password)) ? user : null;
}
