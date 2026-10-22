'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/client/api';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { authErrorMessage } from './error-message';

export function LoginForm() {
  const t = useTranslations('auth');
  const te = useTranslations('auth.errors');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiFetch<{ mfa: boolean }>('/api/auth/login', { body: { email, password } });
    if (res.ok) {
      router.replace(res.data.mfa ? '/login/2fa' : '/');
      router.refresh();
      return;
    }
    setBusy(false);
    setError(authErrorMessage(te, res, res.status === 401 || res.status === 400 ? 'invalidCredentials' : 'generic'));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField label={t('email')} type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <TextField label={t('password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" loading={busy} className="mt-2">
        {t('login.submit')}
      </Button>
      <p className="text-sm text-ink-3">{t('login.privateNote')}</p>
    </form>
  );
}
