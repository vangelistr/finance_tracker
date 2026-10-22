import { getFormatter, getTranslations } from 'next-intl/server';
import { PushToggle } from '@/components/push/push-toggle';
import { Invites } from '@/components/settings/invites';
import { AppearanceForm, ModulesForm, NotificationsForm, PasswordForm, TwoFactorForm } from '@/components/settings/settings-forms';
import { PageHeader, Section } from '@/components/shell/page-header';
import { Notice } from '@/components/ui/notice';
import { requireUser } from '@/server/auth/current';
import { col } from '@/server/db/collections';
import { env, pushConfigured } from '@/server/env';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const { user } = await requireUser();
  const t = await getTranslations('settings');
  const format = await getFormatter();
  const isOwner = user.role === 'owner';
  const { invites, backupRuns } = await col();
  const inviteRows = isOwner
    ? (await invites.find({ createdBy: user._id, usedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(50).toArray()).map((i) => ({
        id: i._id,
        note: i.note,
        expiresAt: i.expiresAt.toISOString(),
      }))
    : [];
  const lastBackup = isOwner ? await backupRuns.findOne({ status: { $in: ['success', 'failed'] } }, { sort: { startedAt: -1 } }) : null;

  return (
    <>
      <PageHeader title={t('title')} meta={`${user.name} · ${user.email}`} />
      <Section title={t('appearance')}>
        <AppearanceForm theme={user.settings.theme} />
      </Section>
      <Section title={t('notifications')}>
        <NotificationsForm notifications={user.settings.notifications} investingEnabled={user.settings.investingEnabled} isOwner={isOwner} />
        <div className="mt-6">
          <h3 className="mb-3 font-semibold">{t('thisDevice')}</h3>
          <PushToggle vapidPublicKey={pushConfigured() ? env().VAPID_PUBLIC_KEY! : null} showTest />
        </div>
      </Section>
      <Section title={t('modules')}>
        <ModulesForm investingEnabled={user.settings.investingEnabled} />
      </Section>
      <Section title={t('security')}>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 font-semibold">{t('changePassword')}</h3>
            <PasswordForm />
          </div>
          <div>
            <h3 className="mb-3 font-semibold">{t('twofaTitle')}</h3>
            <TwoFactorForm enabled={user.totp.enabled} />
          </div>
        </div>
      </Section>
      {isOwner && (
        <Section title={t('invites')}>
          <Invites initial={inviteRows} />
        </Section>
      )}
      {isOwner && (
        <Section title={t('backups')}>
          {!lastBackup && <p className="text-ink-2">{t('backupsNone')}</p>}
          {lastBackup?.status === 'success' && (
            <p className="text-ink-2">{t('backupLast', { date: format.dateTime(lastBackup.finishedAt ?? lastBackup.startedAt, { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
          )}
          {lastBackup?.status === 'failed' && <Notice tone="danger">{t('backupFailed')}</Notice>}
        </Section>
      )}
    </>
  );
}
