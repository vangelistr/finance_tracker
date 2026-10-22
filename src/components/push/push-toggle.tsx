'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

type State = 'loading' | 'unsupported' | 'not-configured' | 'denied' | 'off' | 'on';

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIosOutsideHomeScreen(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !window.matchMedia('(display-mode: standalone)').matches;
}

/** Push permission and subscription for this device. Falls back to in-app notifications when unavailable. */
export function PushToggle({ vapidPublicKey, showTest = false }: { vapidPublicKey: string | null; showTest?: boolean }) {
  const t = useTranslations('onboarding');
  const ts = useTranslations('settings');
  const [state, setState] = useState<State>('loading');
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      let next: State;
      if (!vapidPublicKey) next = 'not-configured';
      else if (!supported) next = 'unsupported';
      else if (Notification.permission === 'denied') next = 'denied';
      else {
        const reg = await navigator.serviceWorker.getRegistration();
        next = (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
      }
      if (!cancelled) {
        setIos(isIosOutsideHomeScreen());
        setState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidPublicKey) });
      const res = await apiFetch('/api/push/subscribe', { body: sub.toJSON() });
      setState(res.ok ? 'on' : 'off');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiFetch('/api/push/unsubscribe', { body: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <div aria-hidden className="h-11 w-56 animate-pulse rounded-md bg-surface-2" />;

  return (
    <div className="flex flex-col gap-3">
      {state === 'not-configured' && <Notice tone="info">{t('notificationsNotConfigured')}</Notice>}
      {state === 'unsupported' && <Notice tone="info">{t('notificationsUnsupported')}</Notice>}
      {state === 'denied' && <Notice tone="warning">{t('notificationsDenied')}</Notice>}
      {ios && state !== 'on' && <Notice tone="info">{t('iosHint')}</Notice>}
      {state === 'off' && (
        <Button variant="secondary" onClick={enable} loading={busy} className="self-start">
          {t('notificationsEnable')}
        </Button>
      )}
      {state === 'on' && (
        <>
          <Notice tone="success">{t('notificationsEnabled')}</Notice>
          <div className="flex flex-wrap gap-2">
            {showTest && (
              <Button variant="secondary" size="sm" onClick={() => apiFetch('/api/push/test', { method: 'POST' })}>
                {ts('pushTest')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={disable} loading={busy}>
              {ts('pushDisable')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
