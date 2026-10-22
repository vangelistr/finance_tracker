import { transactionCreateSchema, transactionListQuery } from '@/lib/validation/finance';
import { transactionDto } from '@/server/services/dto';
import { assertRefsOwned, optionalRef, parseId } from '@/server/services/ids';
import { createTransaction, listTransactions } from '@/server/services/transactions';
import { api } from '@/server/http/api';

export const GET = api('user', async ({ query, auth }) => {
  const q = query(transactionListQuery);
  const list = await listTransactions(auth!.user._id, {
    ...q,
    categoryId: parseId(q.categoryId) ?? undefined,
    accountId: parseId(q.accountId) ?? undefined,
  });
  return { transactions: list.map(transactionDto) };
});

export const POST = api('user', async ({ body, auth }) => {
  const userId = auth!.user._id;
  const input = await body(transactionCreateSchema);
  const refs = {
    accountId: optionalRef(input.accountId),
    toAccountId: optionalRef(input.toAccountId),
    categoryId: optionalRef(input.categoryId),
    incomeSourceId: optionalRef(input.incomeSourceId),
  };
  await assertRefsOwned(userId, {
    account: [refs.accountId, refs.toAccountId],
    category: [refs.categoryId],
    incomeSource: [refs.incomeSourceId],
  });
  const { doc, created } = await createTransaction(userId, {
    kind: input.kind,
    status: input.status,
    amountMinor: input.amountMinor,
    grossMinor: input.grossMinor ?? null,
    ...refs,
    localDate: input.localDate,
    note: input.note,
    clientId: input.clientId ?? null,
    origin: input.origin,
  });
  return Response.json({ transaction: transactionDto(doc), created }, { status: created ? 201 : 200 });
});
