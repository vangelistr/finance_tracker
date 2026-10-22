import { getTranslations } from 'next-intl/server';
import { Categories } from '@/components/finance/categories';
import { PageHeader } from '@/components/shell/page-header';
import { requireUser } from '@/server/auth/current';
import { listCategories, seedCategories } from '@/server/services/categories';
import { categoryDto } from '@/server/services/dto';

export async function generateMetadata() {
  const t = await getTranslations('categories');
  return { title: t('title') };
}

export default async function CategoriesPage() {
  const { user } = await requireUser();
  const t = await getTranslations('categories');
  let list = await listCategories(user._id, { includeArchived: true });
  if (list.length === 0) {
    await seedCategories(user._id, user.locale);
    list = await listCategories(user._id, { includeArchived: true });
  }
  return (
    <>
      <PageHeader title={t('title')} />
      <Categories rows={list.map(categoryDto)} />
    </>
  );
}
