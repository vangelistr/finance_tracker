import type { ObjectId } from 'mongodb';
import type { LocalDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';

export type Locale = 'el' | 'en';
export type Theme = 'system' | 'light' | 'dark';
export type Role = 'owner' | 'member';

export interface NotificationSettings {
  daily: { enabled: boolean; time: string };
  monthly: { enabled: boolean; time: string };
  renewals: { enabled: boolean; defaultDaysBefore: number };
  overspend: { enabled: boolean; thresholds: number[] };
  marketDigest: { enabled: boolean };
  backup: { enabled: boolean };
}

export interface UserSettings {
  investingEnabled: boolean;
  theme: Theme;
  notifications: NotificationSettings;
}

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  locale: Locale;
  currency: string;
  timezone: string;
  totp: { enabled: boolean; secretEnc?: string; pendingSecretEnc?: string; lastStep?: number };
  settings: UserSettings;
  onboardingDoneAt: Date | null;
  passwordChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDoc {
  _id: string; // HMAC-SHA256 of the session token
  userId: ObjectId;
  mfaPending: boolean;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export interface InviteDoc {
  _id: string; // HMAC-SHA256 of the invite token
  createdBy: ObjectId;
  note: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  usedBy: ObjectId | null;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

export interface SetupMeta {
  _id: 'setup';
  completedAt: Date;
  ownerId: ObjectId;
}

export interface WorkerMeta {
  _id: 'worker';
  heartbeatAt: Date;
  startedAt: Date;
  version: string;
}

export type AppMetaDoc = SetupMeta | WorkerMeta;

export interface MigrationDoc {
  _id: string;
  appliedAt: Date;
}

export interface PushSubscriptionDoc {
  _id: ObjectId;
  userId: ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string;
  createdAt: Date;
  lastSuccessAt: Date | null;
  failureCount: number;
}

export interface NotificationDoc {
  _id: ObjectId;
  userId: ObjectId;
  type: string;
  titleKey: string;
  bodyKey: string;
  params: Record<string, string | number>;
  url: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface NotificationLogDoc {
  _id: ObjectId;
  userId: ObjectId;
  key: string;
  type: string;
  status: 'sending' | 'sent' | 'failed' | 'no_subscription';
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupRunDoc {
  _id: ObjectId;
  kind: 'backup' | 'check' | 'restore-test';
  trigger: 'schedule' | 'manual' | 'pre-deploy' | 'pre-restore';
  status: 'running' | 'success' | 'success_with_warning' | 'failed';
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  snapshotId: string | null;
  countsBefore: Record<string, number> | null;
  countsAfter: Record<string, number> | null;
  offsite: boolean;
  error: string | null;
  notifiedAt: Date | null;
}

// Re-exported so domain documents added in later phases share one import path.
export type { LocalDate, Minor };
