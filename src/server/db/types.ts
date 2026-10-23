import type { ObjectId } from 'mongodb';
import type { LocalDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import type { Schedule } from '@/lib/recurrence';
import type { PlanSettings } from '@/lib/plan';
import type { Exchange, InstrumentType, ProviderId, ProviderSymbols, Region } from '@/lib/investing/instruments';
import type { InvestingSettings } from '@/lib/investing/settings';

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
  /** Smart Plan overrides; missing keys use DEFAULT_PLAN_SETTINGS. */
  plan?: Partial<PlanSettings>;
  /** Investing module settings; missing keys use DEFAULT_INVESTING_SETTINGS. `seeded` marks the starter list as added once. */
  investing?: Partial<InvestingSettings> & { seeded?: boolean };
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
  status: 'sending' | 'sent' | 'failed' | 'no_subscription' | 'superseded';
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

// ---- Finance domain (Phase 2) ----

export const ACCOUNT_TYPES = ['checking', 'cash', 'savings', 'investment', 'bills', 'tax_reserve'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface AccountDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  type: AccountType;
  currency: string;
  openingBalanceMinor: Minor;
  openingDate: LocalDate;
  archived: boolean;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryKind = 'expense' | 'income';

export interface CategoryDoc {
  _id: ObjectId;
  userId: ObjectId;
  kind: CategoryKind;
  name: string;
  parentId: ObjectId | null;
  /** Index into the 8-colour categorical chart palette (1–8). */
  color: number;
  icon: string;
  /** Counts toward essentials in the Smart Plan. */
  essential: boolean;
  archived: boolean;
  sort: number;
  seedKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const INCOME_TYPES = ['recurring_fixed', 'recurring_variable', 'one_time'] as const;
export type IncomeType = (typeof INCOME_TYPES)[number];

export interface IncomeSourceDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  type: IncomeType;
  categoryId: ObjectId | null;
  currency: string;
  accountId: ObjectId | null;
  /** Required for recurring_fixed (it generates expected entries); optional for the others. */
  schedule: Schedule | null;
  expectedNetMinor: Minor | null;
  expectedGrossMinor: Minor | null;
  /** Freelance invoices feed the tax/EFKA estimator (Phase 7). */
  freelance: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface RecurringExpenseDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  amountMinor: Minor;
  categoryId: ObjectId | null;
  accountId: ObjectId | null;
  schedule: Schedule;
  /** Set when the fixed expense is a subscription (renewal date = next occurrence). */
  subscription: { status: SubscriptionStatus; reminderDaysBefore: number | null } | null;
  note: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TransactionKind = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'expected' | 'done' | 'skipped';
export type TransactionOrigin = 'manual' | 'generated' | 'offline' | 'tax_set_aside';

export interface TransactionDoc {
  _id: ObjectId;
  userId: ObjectId;
  kind: TransactionKind;
  status: TransactionStatus;
  /** Always positive; the kind gives the direction. Net amount for income. */
  amountMinor: Minor;
  grossMinor: Minor | null;
  accountId: ObjectId | null;
  toAccountId: ObjectId | null;
  categoryId: ObjectId | null;
  incomeSourceId: ObjectId | null;
  recurringExpenseId: ObjectId | null;
  localDate: LocalDate;
  month: string;
  note: string;
  origin: TransactionOrigin;
  /** `<income|expense>:<sourceId>:<localDate>` for generated occurrences (unique per user). */
  occurrenceKey: string | null;
  /** Client-generated UUID from quick-add / the offline queue (unique per user), so replays never duplicate. */
  clientId: string | null;
  doneAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetDoc {
  _id: ObjectId;
  userId: ObjectId;
  /** Top-level expense category; null = the overall monthly budget. */
  categoryId: ObjectId | null;
  amountMinor: Minor;
  updatedAt: Date;
}

export interface GoalDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  targetMinor: Minor;
  deadline: LocalDate | null;
  accountId: ObjectId | null;
  /** 1 = highest. */
  priority: number;
  isEmergencyFund: boolean;
  archived: boolean;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalContributionDoc {
  _id: ObjectId;
  userId: ObjectId;
  goalId: ObjectId;
  amountMinor: Minor;
  localDate: LocalDate;
  month: string;
  source: 'manual' | 'plan';
  /** Set for contributions applied from the Smart Plan: one per goal per month. */
  planMonth: string | null;
  note: string;
  createdAt: Date;
}

// ---- Investing module (Phase 6) ----

export interface WatchlistDoc {
  _id: ObjectId;
  userId: ObjectId;
  symbol: string;
  exchange: Exchange;
  /** `SYMBOL:EXCHANGE`, the shared key of the listing's price history. */
  instrumentKey: string;
  name: string;
  isin: string | null;
  currency: string;
  type: InstrumentType;
  region: Region;
  /** ISO country code of the fund or company domicile. */
  domicile: string;
  terBps: number | null;
  core: boolean;
  leveraged: boolean;
  crypto: boolean;
  providerSymbols: ProviderSymbols;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManualPriceDoc {
  _id: ObjectId;
  userId: ObjectId;
  instrumentKey: string;
  localDate: LocalDate;
  priceMicros: number;
  currency: string;
  createdAt: Date;
}

/** Shared public market data: one end-of-day close per listing and bar date (exchange local date). */
export interface PriceDoc {
  _id: ObjectId;
  instrumentKey: string;
  date: LocalDate;
  closeMicros: number;
  currency: string | null;
  provider: ProviderId;
  /** True when the close is adjusted for splits and dividends (EODHD `adjusted_close`). */
  adjusted: boolean;
  fetchedAt: Date;
  /** TTL: bars older than the metrics window expire. */
  expiresAt: Date;
}

export interface PriceMetaDoc {
  _id: string; // instrumentKey, or 'fx' for the exchange-rate feed
  lastDate: LocalDate | null;
  provider: ProviderId | 'frankfurter' | null;
  fetchedAt: Date | null;
  lastAttemptSlot: string | null;
  lastAttemptAt: Date | null;
  lastError: string | null;
}

/** Negative cache per (provider, listing): `not_covered` for 30 days, `error` for an hour (TTL on `until`). */
export interface ProviderOutcomeDoc {
  _id: string; // `${provider}:${instrumentKey}`
  status: 'not_covered' | 'error';
  detail: string;
  until: Date;
}

/** Call counters per provider day (`provider:YYYY-MM-DD`) and minute (`provider:m:YYYY-MM-DDTHH:MM`). */
export interface ProviderUsageDoc {
  _id: string;
  provider: ProviderId | 'frankfurter';
  calls: number;
  /** Set when the provider answered with a quota or key error: no more calls until its reset. */
  blocked?: boolean;
  expiresAt: Date;
}

/** ECB reference rates, euro base: units of each currency per 1 EUR, for the date the ECB published. */
export interface FxRateDoc {
  _id: LocalDate;
  base: 'EUR';
  rates: Record<string, number>;
  fetchedAt: Date;
  expiresAt: Date;
}

// Re-exported so domain documents added in later phases share one import path.
export type { LocalDate, Minor };
