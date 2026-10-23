import 'server-only';
import { MongoServerError, ObjectId } from 'mongodb';
import type { TxRow } from '@/lib/aggregates';
import { addMonthsToMonth, monthBounds, monthOf, toLocalDate, type Month } from '@/lib/dates';
import { occurrences } from '@/lib/recurrence';
import { buildReport, REPORT_SCHEMA_VERSION } from '@/lib/report';
import { estimateYear } from '@/lib/tax/estimate';
import { col } from '@/server/db/collections';
import type { ReportDoc, UserDoc } from '@/server/db/types';
import { accountBalances } from './accounts';
import { taxConfigFor, taxProfile } from './tax';

// Month-end reports (PLAN 6.7): one immutable snapshot per user and closed month. The unique {userId, month} index
// makes a second attempt a no-op, whether it comes from the worker on the 1st or from the history page.

const HISTORY_MONTHS = 24;

export const lastClosedMonth = (user: Pick<UserDoc, 'timezone'>, now: Date): Month => addMonthsToMonth(monthOf(toLocalDate(now, user.timezone)), -1);

async function reportData(user: UserDoc, month: Month, now: Date) {
  const c = await col();
  const userId = user._id;
  const prev = addMonthsToMonth(month, -1);
  const { first, last } = monthBounds(month);
  const next = monthBounds(addMonthsToMonth(month, 1));
  const [txs, categories, budgets, goals, contributions, fixed, freelance] = await Promise.all([
    c.transactions.find({ userId, status: 'done', month: { $in: [prev, month] } }).toArray(),
    c.categories.find({ userId, kind: 'expense' }).toArray(),
    c.budgets.find({ userId }).toArray(),
    c.goals.find({ userId, archived: false, createdAt: { $lte: new Date(`${next.first}T00:00:00Z`) } }).sort({ isEmergencyFund: -1, priority: 1, seq: 1 }).toArray(),
    c.goalContributions.find({ userId, localDate: { $lte: last } }).toArray(),
    c.recurringExpenses.find({ userId, active: true }).toArray(),
    c.incomeSources.countDocuments({ userId, freelance: true }, { limit: 1 }),
  ]);

  const rows: TxRow[] = txs.map((t) => ({
    kind: t.kind,
    status: t.status,
    amountMinor: t.amountMinor,
    localDate: t.localDate,
    categoryId: t.categoryId?.toHexString() ?? null,
    incomeSourceId: t.incomeSourceId?.toHexString() ?? null,
    accountId: t.accountId?.toHexString() ?? null,
    toAccountId: t.toAccountId?.toHexString() ?? null,
  }));

  const renewals = fixed
    .filter((f) => !f.subscription || f.subscription.status === 'active')
    .flatMap((f) => occurrences(f.schedule, next.first, next.last).map((date) => ({ name: f.name, date, amountMinor: f.amountMinor, subscription: !!f.subscription })));

  let tax = null;
  if (freelance) {
    const year = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const [cfg, reserve, invoiceTxs, sources] = await Promise.all([
      taxConfigFor(userId, year, now),
      c.accounts.findOne({ userId, type: 'tax_reserve', archived: false }, { sort: { sort: 1 } }),
      c.transactions.find({ userId, kind: 'income', status: 'done', localDate: { $gte: `${year}-01-01`, $lte: last } }).toArray(),
      c.incomeSources.find({ userId, freelance: true }, { projection: { _id: 1 } }).toArray(),
    ]);
    const ids = new Set(sources.map((s) => s._id.toHexString()));
    const est = estimateYear({
      taxYear: year,
      profile: taxProfile(user),
      config: cfg.config,
      invoices: invoiceTxs.filter((t) => t.incomeSourceId && ids.has(t.incomeSourceId.toHexString())).map((t) => ({ id: t._id.toHexString(), date: t.localDate, netMinor: t.amountMinor })),
      throughMonth: m,
    });
    const balances = reserve ? await accountBalances(userId, last) : null;
    const moved = await c.transactions.find({ userId, origin: 'tax_set_aside', month }).toArray();
    tax = {
      reserveBalanceMinor: reserve ? (balances!.get(reserve._id.toHexString()) ?? 0) : 0,
      estimatedThroughMonthMinor: est.months.reduce((s, r) => s + r.setAsideMinor, 0),
      movedInMonthMinor: moved.reduce((s, t) => s + t.amountMinor, 0),
    };
  }

  return buildReport({
    month,
    currency: user.currency,
    rows,
    categories: categories.map((x) => ({ id: x._id.toHexString(), name: x.name, parentId: x.parentId?.toHexString() ?? null, color: x.color })),
    budgets: budgets.map((b) => ({ categoryId: b.categoryId?.toHexString() ?? null, amountMinor: b.amountMinor })),
    goals: goals.map((g) => {
      const mine = contributions.filter((x) => x.goalId.equals(g._id));
      return {
        id: g._id.toHexString(),
        name: g.name,
        targetMinor: g.targetMinor,
        savedAtEndMinor: mine.reduce((s, x) => s + x.amountMinor, 0),
        contributedInMonthMinor: mine.filter((x) => x.localDate >= first).reduce((s, x) => s + x.amountMinor, 0),
        isEmergencyFund: g.isEmergencyFund,
        deadline: g.deadline,
      };
    }),
    renewals,
    tax,
    labels: { overall: user.locale === 'en' ? 'Overall' : 'Συνολικά', none: user.locale === 'en' ? 'No category' : 'Χωρίς κατηγορία' },
  });
}

/** Generates the report of a closed month once. Returns the stored snapshot (new or existing). */
export async function ensureReport(user: UserDoc, month: Month, now = new Date()): Promise<ReportDoc | null> {
  if (month > lastClosedMonth(user, now)) return null;
  const c = await col();
  const existing = await c.reports.findOne({ userId: user._id, month });
  if (existing) return existing;
  const doc: ReportDoc = { _id: new ObjectId(), userId: user._id, month, generatedAt: now, schemaVersion: REPORT_SCHEMA_VERSION, data: await reportData(user, month, now) };
  try {
    await c.reports.insertOne(doc);
    return doc;
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) return c.reports.findOne({ userId: user._id, month });
    throw err;
  }
}

/** Fills in missing reports for the closed months since the account was created (at most the last 24). */
export async function ensureClosedReports(user: UserDoc, now = new Date()): Promise<void> {
  const last = lastClosedMonth(user, now);
  const created = monthOf(toLocalDate(user.createdAt, user.timezone));
  const earliest = addMonthsToMonth(last, -(HISTORY_MONTHS - 1));
  const from = created > earliest ? created : earliest;
  const c = await col();
  const have = new Set((await c.reports.find({ userId: user._id }, { projection: { month: 1 } }).toArray()).map((r) => r.month));
  for (let m = from; m <= last; m = addMonthsToMonth(m, 1)) if (!have.has(m)) await ensureReport(user, m, now);
}

export async function listReports(userId: ObjectId) {
  return (await col()).reports.find({ userId }, { projection: { month: 1, generatedAt: 1, 'data.totals': 1, 'data.savingsRateBps': 1 } }).sort({ month: -1 }).toArray();
}

export async function getReport(userId: ObjectId, month: Month) {
  return (await col()).reports.findOne({ userId, month });
}
