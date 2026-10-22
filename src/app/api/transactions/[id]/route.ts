import { transactionPatchSchema } from '@/lib/validation/finance';
import { transactionDto } from '@/server/services/dto';
import { assertRefsOwned, optionalRef, requireId } from '@/server/services/ids';
import { getTransaction, removeTransaction, updateTransaction } from '@/server/services/transactions';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const GET = api<{ id: string }>('user', async ({ params, auth }) => {
  const tx = await getTransaction(auth!.user._id, requireId(params.id));
  if (!tx) throw notFound();
  return { transaction: transactionDto(tx) };
});

export const PATCH = api<{ id: string }>('user', async ({ params, body, auth }) => {
  const userId = auth!.user._id;
  const input = await body(transactionPatchSchema);
  const patch: Parameters<typeof updateTransaction>[2] = {};
  if (input.amountMinor !== undefined) patch.amountMinor = input.amountMinor;
  if (input.grossMinor !== undefined) patch.grossMinor = input.grossMinor ?? null;
  if (input.localDate !== undefined) patch.localDate = input.localDate;
  if (input.note !== undefined) patch.note = input.note;
  if (input.accountId !== undefined) patch.accountId = optionalRef(input.accountId);
  if (input.categoryId !== undefined) patch.categoryId = optionalRef(input.categoryId);
  if (input.incomeSourceId !== undefined) patch.incomeSourceId = optionalRef(input.incomeSourceId);
  await assertRefsOwned(userId, { account: [patch.accountId], category: [patch.categoryId], incomeSource: [patch.incomeSourceId] });
  const updated = await updateTransaction(userId, requireId(params.id), patch);
  if (!updated) throw notFound();
  return { transaction: transactionDto(updated) };
});

export const DELETE = api<{ id: string }>('user', async ({ params, auth }) => {
  const result = await removeTransaction(auth!.user._id, requireId(params.id));
  if (!result) throw notFound();
  return { result };
});
