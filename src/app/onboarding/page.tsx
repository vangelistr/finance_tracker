import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { OnboardingFlow } from '@/components/onboarding/flow';
import { PushToggle } from '@/components/push/push-toggle';
import { PublicFrame } from '@/components/shell/public-frame';
import { toLocalDate } from '@/lib/dates';
import { requireUser } from '@/server/auth/current';
import { env, pushConfigured } from '@/server/env';
import { listCategories, seedCategories } from '@/server/services/categories';
import { categoryDto, incomeSourceDto } from '@/server/services/dto';
import { lookups } from '@/server/services/lookups';
import { listIncomeSources } from '@/server/services/sources';

export async function generateMetadata() {
  const t = await getTranslations('onboarding');
  return { title: t('title') };
}

export default async function OnboardingPage() {
  const { user } = await requireUser();
  if (user.onboardingDoneAt) redirect('/');
  const t = await getTranslations('onboarding');
  if ((await listCategories(user._id)).length === 0) await seedCategories(user._id, user.locale);
  const [sources, categories, l] = await Promise.all([listIncomeSources(user._id, { includeInactive: true }), listCategories(user._id, { includeArchived: true }), lookups(user._id)]);
  return (
    <PublicFrame title={t('title')} showLocale={false} wide>
      <OnboardingFlow
        sources={sources.map(incomeSourceDto)}
        categories={categories.map(categoryDto)}
        incomeCategories={l.categoryOptions.income}
        accounts={l.accountOptions}
        currency={user.currency}
        today={toLocalDate(new Date(), user.timezone)}
        notifications={
          <>
            <h2 className="text-lg font-semibold">{t('notificationsTitle')}</h2>
            <p className="text-ink-2">{t('notificationsBody')}</p>
            <PushToggle vapidPublicKey={pushConfigured() ? env().VAPID_PUBLIC_KEY! : null} />
          </>
        }
      />
    </PublicFrame>
  );
}
