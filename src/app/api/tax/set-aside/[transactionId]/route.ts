import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';
import { transactionDto } from '@/server/services/dto';
import { requireId } from '@/server/services/ids';
import { setAsideInvoice } from '@/server/services/tax';

/** Moves the invoice's VAT + income-tax estimate into the tax reserve; repeating it returns the first transfer. */
export const POST = api<{ transactionId: string }>('user', async ({ params, auth }) => {
  const id = requireId(params.transactionId);
  const res = await setAsideInvoice(auth!.user, id.toHexString());
  if (!res) throw notFound();
  return { transaction: transactionDto(res.transaction), created: res.created };
});
