import { getTranslations } from 'next-intl/server';
import { OfflineQuickAdd } from '@/components/pwa/offline-quick-add';
import { OfflineRetry } from '@/components/pwa/offline-retry';
import { PublicFrame } from '@/components/shell/public-frame';

export async function generateMetadata() {
  const t = await getTranslations('offline');
  return { title: t('title') };
}

// The service worker precaches this page and serves it when a navigation fails.
export default async function OfflinePage() {
  const t = await getTranslations('offline');
  return (
    <PublicFrame title={t('title')} intro={t('body')}>
      <OfflineQuickAdd />
      <OfflineRetry label={t('retry')} />
    </PublicFrame>
  );
}
