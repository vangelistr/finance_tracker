import { z } from 'zod';
import { localDateSchema, noteSchema, objectIdSchema, positiveMinorSchema } from '@/lib/validation/common';
import { transactionDto } from '@/server/services/dto';
import { assertRefsOwned, requireId } from '@/server/services/ids';
import { createTransaction } from '@/server/services/transactions';
import { api } from '@/server/http/api';

const transferSchema = z
  .strictObject({
    fromAccountId: objectIdSchema,
    toAccountId: objectIdSchema,
    amountMinor: positiveMinorSchema,
    localDate: localDateSchema,
    note: noteSchema.default(''),
  })
  .refine((t) => t.fromAccountId !== t.toAccountId, { message: 'choose two different accounts', path: ['toAccountId'] });

export const POST = api('user', async ({ body, auth }) => {
  const userId = auth!.user._id;
  const input = await body(transferSchema);
  const from = requireId(input.fromAccountId);
  const to = requireId(input.toAccountId);
  await assertRefsOwned(userId, { account: [from, to] });
  const { doc } = await createTransaction(userId, {
    kind: 'transfer',
    status: 'done',
    amountMinor: input.amountMinor,
    grossMinor: null,
    accountId: from,
    toAccountId: to,
    categoryId: null,
    incomeSourceId: null,
    localDate: input.localDate,
    note: input.note,
    clientId: null,
    origin: 'manual',
  });
  return Response.json({ transaction: transactionDto(doc) }, { status: 201 });
});
