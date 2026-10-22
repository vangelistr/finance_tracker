'use client';

import { Copy } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';

export interface InviteRow {
  id: string;
  note: string;
  expiresAt: string;
}

export function Invites({ initial }: { initial: InviteRow[] }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const format = useFormatter();
  const [rows, setRows] = useState(initial);
  const [note, setNote] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await apiFetch<{ id: string; url: string; expiresAt: string }>('/api/invites', { body: { note } });
    setBusy(false);
    if (!res.ok) return;
    setLink(res.data.url);
    setCopied(false);
    setRows([{ id: res.data.id, note, expiresAt: res.data.expiresAt }, ...rows]);
    setNote('');
  }

  async function revoke(id: string) {
    const res = await apiFetch(`/api/invites/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) setRows(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-2">{t('invitesHint')}</p>
      <div className="flex max-w-md items-end gap-2">
        <TextField label={t('inviteNote')} value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} className="flex-1" />
        <Button variant="secondary" onClick={create} loading={busy}>
          {t('inviteCreate')}
        </Button>
      </div>
      {link && (
        <Notice tone="info" title={t('inviteLink')}>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-ink">{link}</code>
            <Button
              size="sm"
              variant="secondary"
              icon={<Copy aria-hidden className="size-4" strokeWidth={1.75} />}
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? tc('copied') : tc('copy')}
            </Button>
          </div>
        </Notice>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">{t('inviteNone')}</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate">{r.note || '—'}</p>
                <p className="text-sm text-ink-3">{t('inviteExpires', { date: format.dateTime(new Date(r.expiresAt), { dateStyle: 'medium' }) })}</p>
              </div>
              <Button size="sm" variant="danger" onClick={() => revoke(r.id)}>
                {t('inviteRevoke')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
