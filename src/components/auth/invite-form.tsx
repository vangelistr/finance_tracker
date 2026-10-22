'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/client/api';
import { emailSchema, PASSWORD_MIN } from '@/lib/validation/auth';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { authErrorMessage } from './error-message';

export function InviteForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const te = useTranslations('auth.errors');
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = te('nameRequired');
    if (!emailSchema.safeParse(form.email).success) next.email = te('emailInvalid');
    if (form.password.length < PASSWORD_MIN) next.password = te('passwordShort', { min: PASSWORD_MIN });
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    setError(null);
    const res = await apiFetch('/api/auth/register', { body: { ...form, token, locale } });
    if (res.ok) {
      router.replace('/onboarding');
      router.refresh();
      return;
    }
    setBusy(false);
    if (res.code === 'conflict') setErrors({ email: te('emailTaken') });
    else setError(authErrorMessage(te, res, res.status === 400 ? 'inviteInvalid' : 'generic'));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField label={t('name')} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
      <TextField label={t('email')} type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
      <TextField
        label={t('password')}
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        hint={t('passwordHint', { min: PASSWORD_MIN })}
        error={errors.password}
      />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" loading={busy}>
        {t('invite.submit')}
      </Button>
    </form>
  );
}
