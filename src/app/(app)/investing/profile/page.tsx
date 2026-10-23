import { getTranslations } from 'next-intl/server';
import { LimitsForm, QuestionnaireForm } from '@/components/investing/profile-form';
import { investingSettings } from '@/lib/investing/settings';
import { requireInvestingUser } from '@/server/auth/investing';

export async function generateMetadata() {
  const t = await getTranslations('investing');
  return { title: `${t('tabs.profile')} · ${t('title')}` };
}

export default async function ProfilePage() {
  const { user } = await requireInvestingUser();
  const settings = investingSettings(user.settings.investing);
  return (
    <>
      <QuestionnaireForm answers={settings.answers} />
      <LimitsForm settings={settings} />
    </>
  );
}
