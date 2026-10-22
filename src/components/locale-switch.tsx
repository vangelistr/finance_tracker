'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_COOKIE } from '@/lib/cookie-names';
import { Segmented } from '@/components/ui/segmented';

/** Language toggle for signed-out pages: stores the choice in a cookie and re-renders. */
export function LocaleSwitch({ className }: { className?: string }) {
  const locale = useLocale() as 'el' | 'en';
  const t = useTranslations('locale');
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <Segmented
      className={className}
      label={t('label')}
      value={locale}
      options={[
        { value: 'el', label: 'ΕΛ' },
        { value: 'en', label: 'EN' },
      ]}
      onChange={(next) => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        startTransition(() => router.refresh());
      }}
    />
  );
}
