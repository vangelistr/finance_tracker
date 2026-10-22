import { accountPatchSchema } from '@/lib/validation/finance';
import { removeAccount, updateAccount } from '@/server/services/accounts';
import { accountDto } from '@/server/services/dto';
import { requireId } from '@/server/services/ids';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const PATCH = api<{ id: string }>('user', async ({ params, body, auth }) => {
  const patch = await body(accountPatchSchema);
  const updated = await updateAccount(auth!.user._id, requireId(params.id), patch);
  if (!updated) throw notFound();
  return { account: accountDto(updated) };
});

export const DELETE = api<{ id: string }>('user', async ({ params, auth }) => {
  const result = await removeAccount(auth!.user._id, requireId(params.id));
  if (!result) throw notFound();
  return { result };
});
