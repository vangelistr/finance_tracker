import { getTranslations } from 'next-intl/server';
import { BudgetsForm, type BudgetLine } from '@/components/finance/budgets-form';
import { PageHeader } from '@/components/shell/page-header';
import { expensesByCategory } from '@/lib/aggregates';
import { monthBounds, monthOf, toLocalDate } from '@/lib/dates';
import { requireUser } from '@/server/auth/current';
import { col } from '@/server/db/collections';

export async function generateMetadata() {
  const t = await getTranslations('budgets');
  return { title: t('title') };
}

export default async function BudgetsPage() {
  const { user } = await requireUser();
  const t = await getTranslations('budgets');
  const c = await col();
  const month = monthOf(toLocalDate(new Date(), user.timezone));
  const { first, last } = monthBounds(month);
  const [categories, budgets, txs] = await Promise.all([
    c.categories.find({ userId: user._id, kind: 'expense', archived: false }).sort({ sort: 1 }).toArray(),
    c.budgets.find({ userId: user._id }).toArray(),
    c.transactions.find({ userId: user._id, kind: 'expense', status: 'done', localDate: { $gte: first, $lte: last } }).toArray(),
  ]);
  const cats = categories.map((x) => ({ id: x._id.toHexString(), name: x.name, parentId: x.parentId?.toHexString() ?? null, color: x.color }));
  const spent = new Map(
    expensesByCategory(
      txs.map((x) => ({ kind: x.kind, status: x.status, amountMinor: x.amountMinor, localDate: x.localDate, categoryId: x.categoryId?.toHexString() ?? null, incomeSourceId: null, accountId: null, toAccountId: null })),
      cats,
      first,
      last,
      { none: '' },
    ).map((s) => [s.key, s.valueMinor]),
  );
  const amount = new Map(budgets.map((b) => [b.categoryId?.toHexString() ?? 'overall', b.amountMinor]));
  const totalSpent = txs.reduce((s, x) => s + x.amountMinor, 0);
  const lines: BudgetLine[] = [
    { categoryId: null, label: t('overall'), color: 8, amountMinor: amount.get('overall') ?? 0, spentMinor: totalSpent },
    ...cats
      .filter((x) => !x.parentId)
      .map((x) => ({ categoryId: x.id, label: x.name, color: x.color, amountMinor: amount.get(x.id) ?? 0, spentMinor: spent.get(x.id) ?? 0 })),
  ];
  const thresholds = user.settings.notifications.overspend.thresholds.map((v) => `${v} %`).join(', ');
  return (
    <>
      <PageHeader title={t('title')} meta={t('intro', { thresholds })} />
      <BudgetsForm lines={lines} currency={user.currency} />
    </>
  );
}
