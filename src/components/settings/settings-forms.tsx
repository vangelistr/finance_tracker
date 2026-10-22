'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { apiFetch } from '@/lib/client/api';
import { LOCALE_COOKIE, THEME_COOKIE } from '@/lib/cookie-names';
import { PASSWORD_MIN } from '@/lib/validation/auth';
import type { PublicUser } from '@/server/auth/dto';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';

type Settings = PublicUser['settings'];

async function patchSettings(body: unknown) {
  return apiFetch<{ user: PublicUser }>('/api/settings', { method: 'PATCH', body });
}

export function AppearanceForm({ theme }: { theme: Settings['theme'] }) {
  const t = useTranslations();
  const locale = useLocale() as 'el' | 'en';
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useState(theme);

  async function update(patch: { locale?: 'el' | 'en'; theme?: Settings['theme'] }) {
    const res = await patchSettings(patch);
    if (!res.ok) return;
    if (patch.locale) document.cookie = `${LOCALE_COOKIE}=${patch.locale}; path=/; max-age=31536000; samesite=lax`;
    if (patch.theme) document.cookie = `${THEME_COOKIE}=${patch.theme}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:gap-10">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('locale.label')}</span>
        <Segmented
          label={t('locale.label')}
          value={locale}
          options={[
            { value: 'el', label: t('locale.el') },
            { value: 'en', label: t('locale.en') },
          ]}
          onChange={(v) => update({ locale: v })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('theme.label')}</span>
        <Segmented
          label={t('theme.label')}
          value={current}
          options={[
            { value: 'system', label: t('theme.system') },
            { value: 'light', label: t('theme.light') },
            { value: 'dark', label: t('theme.dark') },
          ]}
          onChange={(v) => {
            setCurrent(v);
            if (v === 'system') delete document.documentElement.dataset.theme;
            else document.documentElement.dataset.theme = v;
            void update({ theme: v });
          }}
        />
      </div>
    </div>
  );
}

export function NotificationsForm({
  notifications,
  investingEnabled,
  isOwner,
}: {
  notifications: Settings['notifications'];
  investingEnabled: boolean;
  isOwner: boolean;
}) {
  const t = useTranslations('settings');
  const [state, setState] = useState(notifications);
  const [error, setError] = useState(false);

  async function update<G extends keyof Settings['notifications']>(group: G, patch: Partial<Settings['notifications'][G]>) {
    const previous = state;
    setState({ ...state, [group]: { ...state[group], ...patch } });
    const res = await patchSettings({ notifications: { [group]: patch } });
    setError(!res.ok);
    if (!res.ok) setState(previous);
  }

  const percent = state.overspend.thresholds.map((v) => `${v} %`).join(', ');

  return (
    <div className="flex flex-col divide-y divide-rule">
      <TimedSwitch
        label={t('dailyReminder')}
        description={t('dailyReminderHint')}
        checked={state.daily.enabled}
        time={state.daily.time}
        timeLabel={t('time')}
        onToggle={(v) => update('daily', { enabled: v })}
        onTime={(v) => update('daily', { time: v })}
      />
      <TimedSwitch
        label={t('monthly')}
        description={t('monthlyHint')}
        checked={state.monthly.enabled}
        time={state.monthly.time}
        timeLabel={t('time')}
        onToggle={(v) => update('monthly', { enabled: v })}
        onTime={(v) => update('monthly', { time: v })}
      />
      <Switch
        label={t('renewals')}
        description={t('renewalsHint', { days: state.renewals.defaultDaysBefore })}
        checked={state.renewals.enabled}
        onChange={(v) => update('renewals', { enabled: v })}
      />
      <Switch label={t('overspend')} description={t('overspendHint', { thresholds: percent })} checked={state.overspend.enabled} onChange={(v) => update('overspend', { enabled: v })} />
      {investingEnabled && (
        <Switch label={t('marketDigest')} description={t('marketDigestHint')} checked={state.marketDigest.enabled} onChange={(v) => update('marketDigest', { enabled: v })} />
      )}
      {isOwner && <Switch label={t('backupAlerts')} checked={state.backup.enabled} onChange={(v) => update('backup', { enabled: v })} />}
      {error && <Notice tone="danger">{t('saveFailed')}</Notice>}
    </div>
  );
}

function TimedSwitch(props: {
  label: string;
  description: string;
  checked: boolean;
  time: string;
  timeLabel: string;
  onToggle: (v: boolean) => void;
  onTime: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 py-1 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex-1">
        <Switch label={props.label} description={props.description} checked={props.checked} onChange={props.onToggle} />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm text-ink-2 sm:pb-0">
        {props.timeLabel}
        <input
          type="time"
          value={props.time}
          disabled={!props.checked}
          onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && props.onTime(e.target.value)}
          className="num min-h-11 rounded-md border border-rule-strong bg-surface px-2 text-ink disabled:text-ink-3"
        />
      </label>
    </div>
  );
}

export function ModulesForm({ investingEnabled }: { investingEnabled: boolean }) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [on, setOn] = useState(investingEnabled);
  return (
    <Switch
      label={t('investing')}
      description={t('investingHint')}
      checked={on}
      onChange={async (v) => {
        setOn(v);
        const res = await patchSettings({ investingEnabled: v });
        if (!res.ok) setOn(!v);
        else router.refresh();
      }}
    />
  );
}

export function PasswordForm() {
  const t = useTranslations('settings');
  const ta = useTranslations('auth');
  const te = useTranslations('auth.errors');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (next.length < PASSWORD_MIN) {
      setErrors({ next: te('passwordShort', { min: PASSWORD_MIN }) });
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await apiFetch('/api/auth/password', { body: { current, next } });
    setBusy(false);
    if (res.ok) {
      setCurrent('');
      setNext('');
      setStatus({ tone: 'success', text: t('passwordChanged') });
    } else if (res.fields?.current) {
      setErrors({ current: t('wrongPassword') });
    } else {
      setStatus({ tone: 'danger', text: te(res.code === 'rate_limited' ? 'rateLimited' : 'generic', { minutes: 15 }) });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4">
      <TextField label={t('currentPassword')} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current} required />
      <TextField
        label={t('newPassword')}
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        hint={ta('passwordHint', { min: PASSWORD_MIN })}
        error={errors.next}
        required
      />
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <Button type="submit" variant="secondary" loading={busy} className="self-start">
        {t('changePassword')}
      </Button>
    </form>
  );
}

export function TwoFactorForm({ enabled }: { enabled: boolean }) {
  const t = useTranslations('settings');
  const ta = useTranslations('auth');
  const te = useTranslations('auth.errors');
  const router = useRouter();
  const [enrol, setEnrol] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const res = await apiFetch<{ secret: string; qr: string }>('/api/auth/totp/start', { method: 'POST' });
    setBusy(false);
    if (res.ok) setEnrol(res.data);
    else setMessage({ tone: 'danger', text: te('generic') });
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await apiFetch('/api/auth/totp/enable', { body: { code } });
    setBusy(false);
    if (res.ok) {
      setEnrol(null);
      setCode('');
      setMessage({ tone: 'success', text: t('twofaEnabled') });
      router.refresh();
    } else setMessage({ tone: 'danger', text: te('invalidCode') });
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await apiFetch('/api/auth/totp/disable', { body: { password, code } });
    setBusy(false);
    if (res.ok) {
      setCode('');
      setPassword('');
      setMessage({ tone: 'success', text: t('twofaDisabled') });
      router.refresh();
    } else setMessage({ tone: 'danger', text: res.fields?.password ? t('wrongPassword') : te('invalidCode') });
  }

  const codeField = (
    <TextField
      label={ta('twofa.code')}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      className="num"
    />
  );

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <p className="text-ink-2">{enabled ? t('twofaOn') : t('twofaOff')}</p>
      {!enabled && !enrol && (
        <Button variant="secondary" onClick={start} loading={busy} className="self-start">
          {t('twofaStart')}
        </Button>
      )}
      {!enabled && enrol && (
        <form onSubmit={confirm} className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">{t('twofaScan')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated on the server */}
          <img src={enrol.qr} alt="" width={200} height={200} className="rounded-md border border-rule bg-white p-2" />
          <p className="text-sm">
            {t('twofaKey')}: <code className="num break-all font-medium">{enrol.secret}</code>
          </p>
          {codeField}
          <Button type="submit" loading={busy} disabled={code.length !== 6} className="self-start">
            {t('twofaConfirm')}
          </Button>
        </form>
      )}
      {enabled && (
        <form onSubmit={disable} className="flex flex-col gap-4">
          <TextField label={t('currentPassword')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {codeField}
          <Button type="submit" variant="danger" loading={busy} disabled={code.length !== 6 || !password} className="self-start">
            {t('twofaDisable')}
          </Button>
        </form>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  );
}
