import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { FinishOnboarding } from '@/components/onboarding/finish';
import { PushToggle } from '@/components/push/push-toggle';
import { PublicFrame } from '@/components/shell/public-frame';
import { requireUser } from '@/server/auth/current';
import { env, pushConfigured } from '@/server/env';

export async function generateMetadata() {
  const t = await getTranslations('onboarding');
  return { title: t('title') };
}

export default async function OnboardingPage() {
  const { user } = await requireUser();
  if (user.onboardingDoneAt) redirect('/');
  const t = await getTranslations('onboarding');
  return (
    <PublicFrame title={t('title')} showLocale={false}>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('notificationsTitle')}</h2>
        <p className="text-ink-2">{t('notificationsBody')}</p>
        <PushToggle vapidPublicKey={pushConfigured() ? env().VAPID_PUBLIC_KEY! : null} />
      </section>
      <FinishOnboarding label={t('finish')} />
    </PublicFrame>
  );
}
