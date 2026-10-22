import { contributionSchema } from '@/lib/validation/goals';
import { addContribution } from '@/server/services/goals';
import { requireId } from '@/server/services/ids';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const POST = api<{ id: string }>('user', async ({ params, body, auth }) => {
  const input = await body(contributionSchema);
  const doc = await addContribution(auth!.user._id, requireId(params.id), input);
  if (!doc) throw notFound();
  return Response.json({ contribution: { id: doc._id.toHexString(), amountMinor: doc.amountMinor, localDate: doc.localDate } }, { status: 201 });
});
