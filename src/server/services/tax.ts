import 'server-only';
import { ObjectId } from 'mongodb';
import { formatLocalDate, daysInMonth, toLocalDate, zonedParts } from '@/lib/dates';
import type { TaxConfig } from '@/lib/tax/config';
import { BUNDLED_TAX_CONFIGS, configYearFor } from '@/lib/tax/configs';
import { DEFAULT_TAX_PROFILE, estimateYear, type Invoice, type TaxProfile } from '@/lib/tax/estimate';
import { col } from '@/server/db/collections';
import type { AccountDoc, UserDoc } from '@/server/db/types';
import { ApiError } from '@/server/http/errors';
import { accountBalances } from './accounts';
import { createTransaction } from './transactions';

// Tax/EFKA estimator service: the user's profile and editable rate copy, invoices from freelance income, and the
// set-aside transfers into the tax reserve account. Every figure is an estimate, not tax advice.

export function taxProfile(user: Pick<UserDoc, 'settings'>): TaxProfile {
  return { ...DEFAULT_TAX_PROFILE, ...(user.settings.tax ?? {}) };
}

/** The user's copy of the rates for a tax year, seeded from the bundled file on first use. */
export async function taxConfigFor(userId: ObjectId, taxYear: number, now = new Date()) {
  const c = await col();
  const configYear = configYearFor(taxYear);
  await c.taxConfigs.updateOne(
    { userId, taxYear: configYear },
    { $setOnInsert: { _id: new ObjectId(), config: BUNDLED_TAX_CONFIGS[configYear]!, edited: false, createdAt: now, updatedAt: now } },
    { upsert: true },
  );
  const doc = (await c.taxConfigs.findOne({ userId, taxYear: configYear }))!;
  return { config: doc.config, edited: doc.edited, updatedAt: doc.updatedAt, configYear, fallback: configYear !== taxYear };
}

export async function saveTaxConfig(userId: ObjectId, taxYear: number, config: TaxConfig, now = new Date()) {
  const c = await col();
  await c.taxConfigs.updateOne({ userId, taxYear }, { $set: { config, edited: true, updatedAt: now }, $setOnInsert: { _id: new ObjectId(), createdAt: now } }, { upsert: true });
}

export async function resetTaxConfig(userId: ObjectId, taxYear: number) {
  await (await col()).taxConfigs.deleteOne({ userId, taxYear });
}

const yearBounds = (y: number) => ({ $gte: `${y}-01-01`, $lte: `${y}-12-31` });

/** Received income from freelance sources in the year: the estimator's invoices (amount = net without VAT). */
async function freelanceInvoices(userId: ObjectId, taxYear: number) {
  const c = await col();
  const sources = await c.incomeSources.find({ userId, freelance: true }).toArray();
  if (sources.length === 0) return { invoices: [] as Invoice[], meta: new Map<string, { accountId: ObjectId | null; source: string; note: string }>() };
  const names = new Map(sources.map((s) => [s._id.toHexString(), s.name]));
  const txs = await c.transactions
    .find({ userId, kind: 'income', status: 'done', incomeSourceId: { $in: sources.map((s) => s._id) }, localDate: yearBounds(taxYear) })
    .sort({ localDate: 1, _id: 1 })
    .toArray();
  return {
    invoices: txs.map((t) => ({ id: t._id.toHexString(), date: t.localDate, netMinor: t.amountMinor })),
    meta: new Map(txs.map((t) => [t._id.toHexString(), { accountId: t.accountId, source: names.get(t.incomeSourceId!.toHexString()) ?? '', note: t.note }])),
  };
}

export const invoiceKey = (txId: string) => `tax:invoice:${txId}`;
export const efkaKey = (taxYear: number, month: number) => `tax:efka:${taxYear}-${String(month).padStart(2, '0')}`;

/**
 * Everything the tax page shows for one year: the full-year projection, the year to date (complete EFKA months only
 * are due), what has already moved to the tax reserve and what is due to move now.
 */
export async function loadTax(user: UserDoc, taxYear: number, now = new Date()) {
  const c = await col();
  const today = zonedParts(now, user.timezone);
  const throughMonth = taxYear < today.year ? 12 : taxYear === today.year ? today.month : 0;
  const [cfg, { invoices, meta }, moved, reserveAccount] = await Promise.all([
    taxConfigFor(user._id, taxYear, now),
    freelanceInvoices(user._id, taxYear),
    c.transactions.find({ userId: user._id, origin: 'tax_set_aside', clientId: { $regex: '^tax:' } }).toArray(),
    c.accounts.findOne({ userId: user._id, type: 'tax_reserve', archived: false }, { sort: { sort: 1 } }),
  ]);
  const profile = taxProfile(user);
  const full = estimateYear({ taxYear, profile, config: cfg.config, invoices });
  const ytd = estimateYear({ taxYear, profile, config: cfg.config, invoices, throughMonth });
  const movedByKey = new Map(moved.map((t) => [t.clientId!, { amountMinor: t.amountMinor, localDate: t.localDate }]));
  const balances = reserveAccount ? await accountBalances(user._id) : null;

  // EFKA for a month is set aside at its end, so only months before the current one are due in the current year.
  const efkaDueThrough = taxYear < today.year ? 12 : taxYear === today.year ? today.month - 1 : 0;
  const yearKeys = new Set([...full.invoices.map((l) => invoiceKey(l.id)), ...full.months.map((m) => efkaKey(taxYear, m.month))]);
  const movedThisYear = [...movedByKey.entries()].filter(([k]) => yearKeys.has(k)).reduce((s, [, v]) => s + v.amountMinor, 0);
  // Due now: the year-to-date estimate (VAT, income tax including EFKA's release, EFKA of ended months) minus what
  // has already moved, so it never exceeds the year-to-date total on the page.
  const ytdSetAside = ytd.months.reduce((s, m) => s + m.setAsideMinor - (m.month > efkaDueThrough ? m.efkaMinor : 0), 0);

  return {
    taxYear,
    throughMonth,
    efkaDueThrough,
    config: cfg.config,
    configYear: cfg.configYear,
    configFallback: cfg.fallback,
    configEdited: cfg.edited,
    profile,
    full,
    ytd,
    invoiceMeta: meta,
    moved: movedByKey,
    reserve: { accountId: reserveAccount?._id.toHexString() ?? null, name: reserveAccount?.name ?? null, balanceMinor: reserveAccount ? (balances!.get(reserveAccount._id.toHexString()) ?? 0) : 0 },
    movedThisYearMinor: movedThisYear,
    dueNowMinor: Math.max(0, ytdSetAside - movedThisYear),
  };
}

export type TaxView = Awaited<ReturnType<typeof loadTax>>;

/** Amount the Smart Plan reserves first this month: the estimated set-aside not yet moved (current tax year). */
export async function taxReserveDue(user: UserDoc, now = new Date()): Promise<number> {
  const c = await col();
  if (!(await c.incomeSources.countDocuments({ userId: user._id, freelance: true }, { limit: 1 }))) return 0;
  return (await loadTax(user, zonedParts(now, user.timezone).year, now)).dueNowMinor;
}

async function reserveAndSource(user: UserDoc, preferred: ObjectId | null, now: Date): Promise<{ reserve: AccountDoc; from: ObjectId }> {
  const c = await col();
  const accounts = await c.accounts.find({ userId: user._id, archived: false }).sort({ sort: 1 }).toArray();
  let reserve = accounts.find((a) => a.type === 'tax_reserve');
  if (!reserve) {
    reserve = {
      _id: new ObjectId(),
      userId: user._id,
      name: user.locale === 'en' ? 'Tax reserve' : 'Αποθεματικό φόρων',
      type: 'tax_reserve',
      currency: user.currency,
      openingBalanceMinor: 0,
      openingDate: toLocalDate(now, user.timezone),
      archived: false,
      sort: accounts.length,
      createdAt: now,
      updatedAt: now,
    };
    await c.accounts.insertOne(reserve);
  }
  const from =
    (preferred && accounts.find((a) => a._id.equals(preferred) && a.type !== 'tax_reserve')?._id) ??
    accounts.find((a) => a.type === 'checking')?._id ??
    accounts.find((a) => a.type !== 'tax_reserve')?._id;
  if (!from) throw new ApiError(409, 'conflict', 'add an account to move money from', { account: 'missing' });
  return { reserve, from };
}

/** Moves an invoice's VAT + income-tax estimate into the tax reserve, once per invoice. */
export async function setAsideInvoice(user: UserDoc, transactionId: string, now = new Date()) {
  const c = await col();
  const tx = await c.transactions.findOne({ _id: new ObjectId(transactionId), userId: user._id, kind: 'income', status: 'done' });
  if (!tx) return null;
  const view = await loadTax(user, Number(tx.localDate.slice(0, 4)), now);
  const line = view.full.invoices.find((l) => l.id === transactionId);
  if (!line) return null;
  if (line.setAsideMinor <= 0) throw new ApiError(409, 'conflict', 'nothing to set aside', { amount: 'zero' });
  const { reserve, from } = await reserveAndSource(user, tx.accountId, now);
  const { doc, created } = await createTransaction(user._id, {
    kind: 'transfer',
    status: 'done',
    amountMinor: line.setAsideMinor,
    grossMinor: null,
    accountId: from,
    toAccountId: reserve._id,
    categoryId: null,
    incomeSourceId: null,
    localDate: toLocalDate(now, user.timezone),
    note: `VAT + income tax estimate · ${tx.localDate}`,
    clientId: invoiceKey(transactionId),
    origin: 'tax_set_aside',
  }, now);
  return { transaction: doc, created };
}

/** Moves a complete month's EFKA estimate into the tax reserve, once per month. */
export async function setAsideEfka(user: UserDoc, taxYear: number, month: number, now = new Date()) {
  const view = await loadTax(user, taxYear, now);
  if (month < 1 || month > view.efkaDueThrough) throw new ApiError(409, 'conflict', 'the month is not complete', { month: 'open' });
  const row = view.full.months.find((m) => m.month === month);
  if (!row || row.efkaMinor <= 0) throw new ApiError(409, 'conflict', 'nothing to set aside', { amount: 'zero' });
  const { reserve, from } = await reserveAndSource(user, null, now);
  const { doc, created } = await createTransaction(user._id, {
    kind: 'transfer',
    status: 'done',
    amountMinor: row.efkaMinor,
    grossMinor: null,
    accountId: from,
    toAccountId: reserve._id,
    categoryId: null,
    incomeSourceId: null,
    localDate: toLocalDate(now, user.timezone),
    note: `EFKA estimate · ${formatLocalDate(taxYear, month, daysInMonth(taxYear, month)).slice(0, 7)}`,
    clientId: efkaKey(taxYear, month),
    origin: 'tax_set_aside',
  }, now);
  return { transaction: doc, created };
}
