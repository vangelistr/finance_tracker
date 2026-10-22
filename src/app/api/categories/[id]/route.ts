import { categoryPatchSchema } from '@/lib/validation/finance';
import { removeCategory, updateCategory } from '@/server/services/categories';
import { categoryDto } from '@/server/services/dto';
import { requireId } from '@/server/services/ids';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const PATCH = api<{ id: string }>('user', async ({ params, body, auth }) => {
  const patch = await body(categoryPatchSchema);
  const updated = await updateCategory(auth!.user._id, requireId(params.id), patch);
  if (!updated) throw notFound();
  return { category: categoryDto(updated) };
});

export const DELETE = api<{ id: string }>('user', async ({ params, auth }) => {
  const result = await removeCategory(auth!.user._id, requireId(params.id));
  if (!result) throw notFound();
  return { result };
});
