'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAction } from '@/lib/client/use-action';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

export interface CategoryRow {
  id: string;
  kind: 'expense' | 'income';
  name: string;
  parentId: string | null;
  color: number;
  essential: boolean;
  archived: boolean;
}

const COLOURS = [1, 2, 3, 4, 5, 6, 7, 8];

export function Categories({ rows }: { rows: CategoryRow[] }) {
  const t = useTranslations('categories');
  const tc = useTranslations('common');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [editing, setEditing] = useState<{ row: CategoryRow | null; parentId: string | null } | null>(null);
  const { run } = useAction();
  const visible = rows.filter((r) => r.kind === kind && !r.archived);
  const parents = visible.filter((r) => !r.parentId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <Segmented label={t('title')} value={kind} onChange={setKind} options={[{ value: 'expense', label: t('expense') }, { value: 'income', label: t('income') }]} />
        <Button icon={<Plus aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setEditing({ row: null, parentId: null })}>
          {t('add')}
        </Button>
      </div>
      <ul className="border-t border-rule">
        {parents.map((p) => {
          const children = visible.filter((c) => c.parentId === p.id);
          return (
            <li key={p.id} className="border-b border-rule py-1">
              <div className="flex min-h-12 items-center gap-3">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: `var(--chart-${p.color})` }} />
                <button type="button" onClick={() => setEditing({ row: p, parentId: null })} className="min-w-0 flex-1 truncate text-left font-medium hover:underline">
                  {p.name}
                </button>
                {kind === 'expense' && (
                  <label className="flex min-h-11 items-center gap-2 text-sm text-ink-2">
                    <input
                      type="checkbox"
                      checked={p.essential}
                      onChange={(e) => run(`/api/categories/${p.id}`, { method: 'PATCH', body: { essential: e.target.checked } })}
                      className="size-4 accent-[var(--accent)]"
                    />
                    {t('essential')}
                  </label>
                )}
                <Button size="sm" variant="ghost" icon={<Plus aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setEditing({ row: null, parentId: p.id })}>
                  <span className="sr-only sm:not-sr-only">{t('addSub')}</span>
                </Button>
              </div>
              {children.length > 0 && (
                <ul className="mb-2 ml-1.5 flex flex-wrap gap-2 border-l border-rule pl-5">
                  {children.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setEditing({ row: c, parentId: p.id })} className="min-h-10 rounded-full border border-rule px-3 text-sm text-ink-2 hover:border-rule-strong hover:text-ink">
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {editing && (
        <CategoryForm
          key={editing.row?.id ?? `new-${editing.parentId}`}
          row={editing.row}
          parentId={editing.parentId}
          kind={kind}
          onClose={() => setEditing(null)}
          labels={{ close: tc('close') }}
        />
      )}
    </>
  );
}

function CategoryForm({ row, parentId, kind, onClose, labels }: { row: CategoryRow | null; parentId: string | null; kind: 'expense' | 'income'; onClose: () => void; labels: { close: string } }) {
  const t = useTranslations('categories');
  const tc = useTranslations('common');
  const { run, busy, error } = useAction();
  const [name, setName] = useState(row?.name ?? '');
  const [color, setColor] = useState(row?.color ?? 8);
  const [essential, setEssential] = useState(row?.essential ?? false);

  async function save() {
    if (!name.trim()) return;
    const ok = row
      ? await run(`/api/categories/${row.id}`, { method: 'PATCH', body: { name: name.trim(), color, essential } })
      : await run('/api/categories', { body: { kind, name: name.trim(), parentId, color, essential } });
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={row ? t('edit') : parentId ? t('addSub') : t('add')} closeLabel={labels.close}>
      <div className="flex flex-col gap-4">
        <TextField label={tc('name')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
        {!parentId && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('color')}</legend>
            <div className="flex flex-wrap gap-2">
              {COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`${t('color')} ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn('grid size-11 place-items-center rounded-full border-2', color === c ? 'border-ink' : 'border-transparent')}
                >
                  <span className="size-7 rounded-full" style={{ background: `var(--chart-${c})` }} />
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {kind === 'expense' && (
          <div className="border-y border-rule">
            <Switch label={t('essential')} description={t('essentialHint')} checked={essential} onChange={setEssential} />
          </div>
        )}
        {error && <Notice tone="danger">{error.code === 'conflict' ? t('nameTaken') : tc('saveFailed')}</Notice>}
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={busy} disabled={!name.trim()}>
            {tc('save')}
          </Button>
          {row && (
            <Button variant="danger" className="ml-auto" onClick={async () => (await run(`/api/categories/${row.id}`, { method: 'DELETE' })) && onClose()}>
              {tc('delete')}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
