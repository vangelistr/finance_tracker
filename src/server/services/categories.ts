import 'server-only';
import { MongoServerError, ObjectId } from 'mongodb';
import { EXPENSE_SEEDS, INCOME_SEEDS, type SeedCategory } from '@/lib/seed-categories';
import type { CategoryCreate } from '@/lib/validation/finance';
import { col } from '@/server/db/collections';
import type { CategoryDoc, CategoryKind, Locale } from '@/server/db/types';
import { ApiError } from '@/server/http/errors';

function isDuplicate(err: unknown) {
  return err instanceof MongoServerError && err.code === 11000;
}

/** Inserts the default categories once (keyed by seedKey); a user's own category with the same name wins. */
export async function seedCategories(userId: ObjectId, locale: Locale, now = new Date()): Promise<number> {
  const { categories } = await col();
  let inserted = 0;
  type SeedNode = Pick<SeedCategory, 'key' | 'el' | 'en'> & Partial<Pick<SeedCategory, 'icon' | 'color' | 'essential'>>;
  const insert = async (kind: CategoryKind, s: SeedNode, parent: CategoryDoc | null, sort: number) => {
    const seedKey = parent ? `${kind}:${parent.seedKey?.split(':')[1]}/${s.key}` : `${kind}:${s.key}`;
    const existing = await categories.findOne({ userId, seedKey });
    if (existing) return existing;
    const doc: CategoryDoc = {
      _id: new ObjectId(),
      userId,
      kind,
      name: locale === 'el' ? s.el : s.en,
      parentId: parent?._id ?? null,
      color: s.color ?? parent?.color ?? 8,
      icon: s.icon ?? parent?.icon ?? 'circle',
      essential: s.essential ?? parent?.essential ?? false,
      archived: false,
      sort,
      seedKey,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await categories.insertOne(doc);
      inserted++;
      return doc;
    } catch (err) {
      if (isDuplicate(err)) return categories.findOne({ userId, kind, parentId: doc.parentId, name: doc.name }, { collation: { locale: 'el', strength: 2 } });
      throw err;
    }
  };
  for (const [kind, seeds] of [['expense', EXPENSE_SEEDS], ['income', INCOME_SEEDS]] as const) {
    for (const [i, seed] of seeds.entries()) {
      const parent = await insert(kind, seed, null, i);
      if (!parent) continue;
      for (const [j, child] of (seed.children ?? []).entries()) await insert(kind, child, parent, j);
    }
  }
  return inserted;
}

export async function listCategories(userId: ObjectId, opts: { includeArchived?: boolean } = {}): Promise<CategoryDoc[]> {
  const { categories } = await col();
  return categories.find({ userId, ...(opts.includeArchived ? {} : { archived: false }) }).sort({ kind: 1, sort: 1, name: 1 }).toArray();
}

export async function createCategory(userId: ObjectId, input: Omit<CategoryCreate, 'parentId'> & { parentId: ObjectId | null }, now = new Date()) {
  const { categories } = await col();
  if (input.parentId) {
    const parent = await categories.findOne({ _id: input.parentId, userId });
    if (!parent || parent.kind !== input.kind || parent.parentId) {
      throw new ApiError(400, 'validation', 'invalid parent category', { parentId: 'invalid' });
    }
  }
  const sort = await categories.countDocuments({ userId, kind: input.kind, parentId: input.parentId });
  const doc: CategoryDoc = {
    _id: new ObjectId(),
    userId,
    kind: input.kind,
    name: input.name,
    parentId: input.parentId,
    color: input.color,
    icon: input.icon,
    essential: input.essential,
    archived: false,
    sort,
    seedKey: null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await categories.insertOne(doc);
  } catch (err) {
    if (isDuplicate(err)) throw new ApiError(409, 'conflict', 'a category with this name exists', { name: 'taken' });
    throw err;
  }
  return doc;
}

export async function updateCategory(userId: ObjectId, id: ObjectId, set: Partial<Pick<CategoryDoc, 'name' | 'color' | 'icon' | 'essential' | 'archived' | 'sort'>>) {
  const { categories } = await col();
  try {
    return await categories.findOneAndUpdate({ _id: id, userId }, { $set: { ...set, updatedAt: new Date() } }, { returnDocument: 'after' });
  } catch (err) {
    if (isDuplicate(err)) throw new ApiError(409, 'conflict', 'a category with this name exists', { name: 'taken' });
    throw err;
  }
}

/** Deletes an unused category (and its unused subcategories); a category with history is archived instead. */
export async function removeCategory(userId: ObjectId, id: ObjectId): Promise<'deleted' | 'archived' | null> {
  const c = await col();
  const category = await c.categories.findOne({ _id: id, userId });
  if (!category) return null;
  const ids = [id, ...(await c.categories.find({ userId, parentId: id }, { projection: { _id: 1 } }).toArray()).map((x) => x._id)];
  const used =
    (await c.transactions.countDocuments({ userId, categoryId: { $in: ids } }, { limit: 1 })) +
    (await c.incomeSources.countDocuments({ userId, categoryId: { $in: ids } }, { limit: 1 })) +
    (await c.recurringExpenses.countDocuments({ userId, categoryId: { $in: ids } }, { limit: 1 }));
  if (used > 0) {
    await c.categories.updateMany({ userId, _id: { $in: ids } }, { $set: { archived: true, updatedAt: new Date() } });
    return 'archived';
  }
  await c.categories.deleteMany({ userId, _id: { $in: ids } });
  return 'deleted';
}
