import 'server-only';
import type { ObjectId } from 'mongodb';
import { col } from '@/server/db/collections';
import { ApiError } from '@/server/http/errors';

export async function listBudgets(userId: ObjectId) {
  const { budgets } = await col();
  return budgets.find({ userId }).toArray();
}

/**
 * Replaces the user's budgets with the given set (null category = overall). A zero amount removes that budget.
 * Budgets apply to top-level expense categories only, because subcategory spending rolls up to its parent.
 */
export async function setBudgets(userId: ObjectId, items: Array<{ categoryId: ObjectId | null; amountMinor: number }>, now = new Date()) {
  const c = await col();
  const ids = items.map((i) => i.categoryId).filter((x): x is ObjectId => !!x);
  if (ids.length > 0) {
    const valid = await c.categories.countDocuments({ userId, _id: { $in: ids }, kind: 'expense', parentId: null });
    if (valid !== new Set(ids.map(String)).size) throw new ApiError(400, 'validation', 'budgets apply to your top-level expense categories', { categoryId: 'invalid' });
  }
  const keep = items.filter((i) => i.amountMinor > 0);
  await c.budgets.deleteMany({ userId, categoryId: { $nin: keep.map((i) => i.categoryId) } });
  for (const i of keep) {
    await c.budgets.updateOne({ userId, categoryId: i.categoryId }, { $set: { amountMinor: i.amountMinor, updatedAt: now } }, { upsert: true });
  }
  return listBudgets(userId);
}
