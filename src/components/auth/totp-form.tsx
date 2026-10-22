'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/client/api';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { authErrorMessage } from './error-message';

export function TotpForm() {
  const t = useTranslations('auth');
  const te = useTranslations('auth.errors');
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiFetch('/api/auth/login/totp', { body: { code } });
    if (res.ok) {
      router.replace('/');
      router.refresh();
      return;
    }
    setBusy(false);
    if (res.status === 401) {
      // The pending sign-in expired (10 minutes): start again.
      router.replace('/login');
      return;
    }
    setError(authErrorMessage(te, res, res.code === 'validation' ? 'invalidCode' : 'generic'));
  }

  async function useOther() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField
        label={t('twofa.code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="num"
        autoFocus
        required
      />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>
        {t('twofa.submit')}
      </Button>
      <Button variant="ghost" onClick={useOther}>
        {t('twofa.useOther')}
      </Button>
    </form>
  );
}
