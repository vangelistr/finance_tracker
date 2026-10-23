import 'server-only';
import type { Collection, Db, IndexDescription } from 'mongodb';
import { getDb } from './client';
import type {
  AccountDoc,
  AppMetaDoc,
  BudgetDoc,
  GoalContributionDoc,
  GoalDoc,
  CategoryDoc,
  IncomeSourceDoc,
  RecurringExpenseDoc,
  TransactionDoc,
  BackupRunDoc,
  InviteDoc,
  MigrationDoc,
  NotificationDoc,
  NotificationLogDoc,
  PushSubscriptionDoc,
  RateLimitDoc,
  SessionDoc,
  UserDoc,
  WatchlistDoc,
  ManualPriceDoc,
  PriceDoc,
  PriceMetaDoc,
  ProviderOutcomeDoc,
  ProviderUsageDoc,
  FxRateDoc,
} from './types';

export function collectionsOf(db: Db) {
  return {
    users: db.collection<UserDoc>('users'),
    sessions: db.collection<SessionDoc>('sessions'),
    invites: db.collection<InviteDoc>('invites'),
    rateLimits: db.collection<RateLimitDoc>('rate_limits'),
    appMeta: db.collection<AppMetaDoc>('app_meta'),
    migrations: db.collection<MigrationDoc>('migrations'),
    pushSubscriptions: db.collection<PushSubscriptionDoc>('push_subscriptions'),
    notifications: db.collection<NotificationDoc>('notifications'),
    notificationLog: db.collection<NotificationLogDoc>('notification_log'),
    backupRuns: db.collection<BackupRunDoc>('backup_runs'),
    accounts: db.collection<AccountDoc>('accounts'),
    categories: db.collection<CategoryDoc>('categories'),
    incomeSources: db.collection<IncomeSourceDoc>('income_sources'),
    recurringExpenses: db.collection<RecurringExpenseDoc>('recurring_expenses'),
    transactions: db.collection<TransactionDoc>('transactions'),
    budgets: db.collection<BudgetDoc>('budgets'),
    goals: db.collection<GoalDoc>('goals'),
    goalContributions: db.collection<GoalContributionDoc>('goal_contributions'),
    watchlist: db.collection<WatchlistDoc>('watchlist'),
    manualPrices: db.collection<ManualPriceDoc>('manual_prices'),
    // Shared collections below hold public market data and counters only, never user data.
    prices: db.collection<PriceDoc>('prices'),
    priceMeta: db.collection<PriceMetaDoc>('price_meta'),
    providerOutcomes: db.collection<ProviderOutcomeDoc>('provider_outcomes'),
    providerUsage: db.collection<ProviderUsageDoc>('provider_usage'),
    fxRates: db.collection<FxRateDoc>('fx_rates'),
  };
}

export type Collections = ReturnType<typeof collectionsOf>;

export async function col(): Promise<Collections> {
  return collectionsOf(await getDb());
}

const DAY = 86_400;

/** Every index the app relies on. `createIndexes` with an identical spec is a no-op, so this is idempotent. */
export const INDEXES: Record<string, IndexDescription[]> = {
  users: [{ key: { email: 1 }, name: 'email_unique', unique: true }],
  sessions: [
    { key: { expiresAt: 1 }, name: 'ttl', expireAfterSeconds: 0 },
    { key: { userId: 1 }, name: 'user' },
  ],
  invites: [{ key: { expiresAt: 1 }, name: 'ttl', expireAfterSeconds: 0 }],
  rate_limits: [{ key: { expiresAt: 1 }, name: 'ttl', expireAfterSeconds: 0 }],
  push_subscriptions: [
    { key: { endpoint: 1 }, name: 'endpoint_unique', unique: true },
    { key: { userId: 1 }, name: 'user' },
  ],
  notifications: [
    { key: { userId: 1, readAt: 1, createdAt: -1 }, name: 'user_unread' },
    { key: { createdAt: 1 }, name: 'ttl', expireAfterSeconds: 90 * DAY },
  ],
  notification_log: [
    { key: { userId: 1, key: 1 }, name: 'user_key_unique', unique: true },
    { key: { createdAt: 1 }, name: 'ttl', expireAfterSeconds: 400 * DAY },
  ],
  backup_runs: [{ key: { startedAt: -1 }, name: 'started' }],
  accounts: [{ key: { userId: 1, archived: 1, sort: 1 }, name: 'user_list' }],
  categories: [
    { key: { userId: 1, kind: 1, parentId: 1, sort: 1 }, name: 'user_tree' },
    {
      key: { userId: 1, kind: 1, parentId: 1, name: 1 },
      name: 'user_name_unique',
      unique: true,
      collation: { locale: 'el', strength: 2 },
    },
  ],
  income_sources: [{ key: { userId: 1, active: 1 }, name: 'user_active' }],
  recurring_expenses: [{ key: { userId: 1, active: 1 }, name: 'user_active' }],
  transactions: [
    { key: { userId: 1, localDate: -1 }, name: 'user_date' },
    { key: { userId: 1, month: 1, kind: 1 }, name: 'user_month_kind' },
    { key: { userId: 1, categoryId: 1, month: 1 }, name: 'user_category_month' },
    {
      key: { userId: 1, occurrenceKey: 1 },
      name: 'user_occurrence_unique',
      unique: true,
      partialFilterExpression: { occurrenceKey: { $type: 'string' } },
    },
    {
      key: { userId: 1, clientId: 1 },
      name: 'user_client_unique',
      unique: true,
      partialFilterExpression: { clientId: { $type: 'string' } },
    },
  ],
  budgets: [{ key: { userId: 1, categoryId: 1 }, name: 'user_category_unique', unique: true }],
  goals: [{ key: { userId: 1, archived: 1, priority: 1 }, name: 'user_list' }],
  goal_contributions: [
    { key: { userId: 1, goalId: 1, localDate: 1 }, name: 'user_goal_date' },
    {
      key: { userId: 1, goalId: 1, planMonth: 1 },
      name: 'user_goal_plan_unique',
      unique: true,
      partialFilterExpression: { planMonth: { $type: 'string' } },
    },
  ],
  watchlist: [
    { key: { userId: 1, symbol: 1, exchange: 1 }, name: 'user_listing_unique', unique: true },
    { key: { userId: 1, seq: 1 }, name: 'user_list' },
  ],
  manual_prices: [{ key: { userId: 1, instrumentKey: 1, localDate: 1 }, name: 'user_listing_date_unique', unique: true }],
  prices: [
    { key: { instrumentKey: 1, date: 1 }, name: 'listing_date_unique', unique: true },
    { key: { expiresAt: 1 }, name: 'ttl', expireAfterSeconds: 0 },
  ],
  provider_outcomes: [{ key: { until: 1 }, name: 'ttl', expireAfterSeconds: 0 }],
  provider_usage: [{ key: { expiresAt: 1 }, name: 'ttl', expireAfterSeconds: 0 }],
  fx_rates: [{ key: { expiresAt: 1 }, name: 'ttl', expireAfterSeconds: 0 }],
};

export async function ensureIndexes(db: Db): Promise<void> {
  for (const [name, indexes] of Object.entries(INDEXES)) {
    if (indexes.length === 0) continue;
    await (db.collection(name) as Collection).createIndexes(indexes);
  }
}
