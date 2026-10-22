import 'server-only';
import { ObjectId } from 'mongodb';
import { ApiError } from '@/server/http/errors';
import { col } from '@/server/db/collections';

/** Parses a 24-hex id from user input; anything else is "not found", never a 500. */
export function parseId(id: string | null | undefined): ObjectId | null {
  return id && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export function requireId(id: string): ObjectId {
  const parsed = parseId(id);
  if (!parsed) throw new ApiError(404, 'not_found');
  return parsed;
}

export function optionalRef(id: string | null | undefined): ObjectId | null {
  if (id === null || id === undefined || id === '') return null;
  const parsed = parseId(id);
  if (!parsed) throw new ApiError(400, 'validation', 'invalid reference');
  return parsed;
}

type RefKind = 'account' | 'category' | 'incomeSource' | 'recurringExpense';

/** Every referenced document must belong to the same user; otherwise the request is invalid (never a leak). */
export async function assertRefsOwned(userId: ObjectId, refs: Partial<Record<RefKind, Array<ObjectId | null | undefined>>>) {
  const c = await col();
  const checks: Array<Promise<void>> = [];
  const check = (name: string, collection: { countDocuments: (f: object) => Promise<number> }, ids: ObjectId[]) => {
    if (ids.length === 0) return;
    checks.push(
      collection.countDocuments({ userId, _id: { $in: ids } }).then((n) => {
        if (n !== new Set(ids.map(String)).size) throw new ApiError(400, 'validation', `unknown ${name}`, { [name]: 'unknown' });
      }),
    );
  };
  const clean = (v?: Array<ObjectId | null | undefined>) => (v ?? []).filter((x): x is ObjectId => !!x);
  check('accountId', c.accounts, clean(refs.account));
  check('categoryId', c.categories, clean(refs.category));
  check('incomeSourceId', c.incomeSources, clean(refs.incomeSource));
  check('recurringExpenseId', c.recurringExpenses, clean(refs.recurringExpense));
  await Promise.all(checks);
}
