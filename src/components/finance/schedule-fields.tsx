'use client';

import { useTranslations } from 'next-intl';
import { FREQUENCIES, type Schedule } from '@/lib/recurrence';
import { SelectField, TextField } from '@/components/ui/field';

/** Frequency, start date and (for monthly or longer) the day of the month. */
export function ScheduleFields({ value, onChange }: { value: Schedule; onChange: (s: Schedule) => void }) {
  const t = useTranslations('frequency');
  const monthly = value.frequency === 'monthly' || value.frequency === 'quarterly' || value.frequency === 'yearly';
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SelectField label={t('label')} value={value.frequency} onChange={(e) => onChange({ ...value, frequency: e.target.value as Schedule['frequency'] })}>
        {FREQUENCIES.map((f) => (
          <option key={f} value={f}>
            {t(f)}
          </option>
        ))}
      </SelectField>
      <TextField label={t('startDate')} type="date" value={value.startDate} onChange={(e) => e.target.value && onChange({ ...value, startDate: e.target.value })} />
      {monthly ? (
        <TextField
          label={t('dayOfMonth')}
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={value.dayOfMonth ?? Number(value.startDate.slice(8, 10))}
          onChange={(e) => {
            const day = Math.min(31, Math.max(1, Number(e.target.value) || 1));
            onChange({ ...value, dayOfMonth: day });
          }}
        />
      ) : (
        <TextField label={t('endDate')} type="date" value={value.endDate ?? ''} onChange={(e) => onChange({ ...value, endDate: e.target.value || null })} />
      )}
    </div>
  );
}

export function scheduleSummary(s: Schedule, t: (key: string) => string): string {
  const day = s.dayOfMonth ?? Number(s.startDate.slice(8, 10));
  return ['monthly', 'quarterly', 'yearly'].includes(s.frequency) ? `${t(s.frequency)} · ${day}` : t(s.frequency);
}
