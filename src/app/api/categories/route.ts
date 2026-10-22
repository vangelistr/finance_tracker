import { categoryCreateSchema } from '@/lib/validation/finance';
import { createCategory, listCategories, seedCategories } from '@/server/services/categories';
import { categoryDto } from '@/server/services/dto';
import { optionalRef } from '@/server/services/ids';
import { api } from '@/server/http/api';

export const GET = api('user', async ({ auth }) => {
  const { user } = auth!;
  let categories = await listCategories(user._id, { includeArchived: true });
  if (categories.length === 0) {
    await seedCategories(user._id, user.locale);
    categories = await listCategories(user._id, { includeArchived: true });
  }
  return { categories: categories.map(categoryDto) };
});

export const POST = api('user', async ({ body, auth }) => {
  const input = await body(categoryCreateSchema);
  const doc = await createCategory(auth!.user._id, { ...input, parentId: optionalRef(input.parentId) });
  return { category: categoryDto(doc) };
});
