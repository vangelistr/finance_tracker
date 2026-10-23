'use client';

import { Info, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useAction } from '@/lib/client/use-action';
import { EXCHANGE_INFO, EXCHANGES, INSTRUMENT_TYPES, parsePrice, PROVIDERS, REGIONS, TRADING_CURRENCIES, WATCHLIST_MAX, WATCHLIST_WARN, type Exchange } from '@/lib/investing/instruments';
import { formatDay, intlLocale } from '@/lib/intl';
import type { WatchlistItem } from '@/server/services/investing';
import { formatBp, formatPrice } from './format';

export interface WatchlistRow extends WatchlistItem {
  lastDate: string | null;
  lastPriceMicros: number | null;
  source: string | null;
  stale: boolean;
}

const PROVIDER_LABELS: Record<(typeof PROVIDERS)[number], string> = { twelvedata: 'Twelve Data', eodhd: 'EODHD', fmp: 'FMP', alphavantage: 'Alpha Vantage', finnhub: 'Finnhub' };

export function Watchlist({ rows, today }: { rows: WatchlistRow[]; today: string }) {
  const t = useTranslations('investing');
  const tw = useTranslations('investing.watchlist');
  const locale = useLocale();
  const loc = intlLocale(locale);
  const [editing, setEditing] = useState<WatchlistRow | 'new' | null>(null);
  const [pricing, setPricing] = useState<WatchlistRow | null>(null);
  const full = rows.length >= WATCHLIST_MAX;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-4">
        <Button icon={<Plus aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setEditing('new')} disabled={full}>
          {tw('add')}
        </Button>
        <span className="num text-ink-2">{tw('count', { count: rows.length, max: WATCHLIST_MAX })}</span>
      </div>
      {rows.length > WATCHLIST_WARN && (
        <Notice tone="warning" className="mb-4">
          {full ? tw('limit') : tw('warnLarge')}
        </Notice>
      )}
      <p className="mb-4 max-w-prose text-sm text-ink-2">{tw('starterNote')}</p>

      {rows.length === 0 ? (
        <div className="border-t border-rule py-6">
          <p className="font-semibold">{t('emptyTitle')}</p>
        </div>
      ) : (
        <ul className="border-t border-rule">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-rule py-4">
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setEditing(r)} className="flex min-h-11 flex-wrap items-baseline gap-x-2 text-left hover:underline">
                  <span className="text-lg font-semibold">{r.symbol}</span>
                  <span className="text-sm text-ink-2">
                    {EXCHANGE_INFO[r.exchange].label} · {r.currency}
                  </span>
                </button>
                <p className="text-sm text-ink-2">{r.name}</p>
                <p className="mt-1 text-sm text-ink-2">
                  {[
                    tw(`types.${r.type}`),
                    tw(`regions.${r.region}`),
                    r.terBps !== null ? `TER ${formatBp(r.terBps, loc)} %` : null,
                    r.core ? t('core') : null,
                    r.isin,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {r.euRetailNote && (
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-2">
                    <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                    {t('euNote')}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                {r.lastPriceMicros !== null && r.lastDate ? (
                  <>
                    <span className="num font-medium">{formatPrice(r.lastPriceMicros, r.currency, loc)}</span>
                    <span className={r.stale ? 'text-sm font-medium text-warning' : 'text-sm text-ink-2'}>
                      {r.source ? `${t(`source.${r.source}` as never)} · ` : ''}
                      {formatDay(r.lastDate, locale, { day: 'numeric', month: 'short' })}
                      {r.stale ? ` · ${t('stale')}` : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-ink-3">{t('dataNone')}</span>
                )}
                <Button size="sm" variant="secondary" onClick={() => setPricing(r)}>
                  {tw('manualPrice')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <InstrumentForm key={editing === 'new' ? 'new' : editing.id} row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {pricing && <ManualPriceForm row={pricing} today={today} onClose={() => setPricing(null)} />}
    </>
  );
}

function InstrumentForm({ row, onClose }: { row: WatchlistRow | null; onClose: () => void }) {
  const tw = useTranslations('investing.watchlist');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [symbol, setSymbol] = useState(row?.symbol ?? '');
  const [exchange, setExchange] = useState<Exchange>(row?.exchange ?? 'XETR');
  const [name, setName] = useState(row?.name ?? '');
  const [isin, setIsin] = useState(row?.isin ?? '');
  const [currency, setCurrency] = useState(row?.currency ?? 'EUR');
  const [type, setType] = useState(row?.type ?? 'etf');
  const [region, setRegion] = useState(row?.region ?? 'global');
  const [domicile, setDomicile] = useState(row?.domicile ?? '');
  const [ter, setTer] = useState(row && row.terBps !== null ? formatBp(row.terBps, intlLocale(locale)) : '');
  const [core, setCore] = useState(row?.core ?? false);
  const [leveraged, setLeveraged] = useState(row?.leveraged ?? false);
  const [crypto, setCrypto] = useState(row?.crypto ?? false);
  const [symbols, setSymbols] = useState<Record<string, string>>({ ...(row?.providerSymbols ?? {}) });
  const [confirming, setConfirming] = useState(false);

  const terText = ter.trim().replace(',', '.');
  const terBps = terText === '' ? null : /^\d{1,2}(\.\d{1,2})?$/.test(terText) ? Math.round(Number(terText) * 100) : NaN;
  const valid = symbol.trim() && name.trim() && /^[A-Za-z]{2}$/.test(domicile.trim()) && !Number.isNaN(terBps);
  const fieldError = (key: string) => (error?.fields?.[key] === 'exists' ? tw('exists') : error?.fields?.[key] === 'limit' ? tw('limit') : error?.fields?.[key] ? tc('invalid') : undefined);

  async function save() {
    if (!valid) return;
    const providerSymbols = Object.fromEntries(Object.entries(symbols).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    const body = { name: name.trim(), isin: isin.trim() || null, currency, type, region, domicile: domicile.trim(), terBps, core, leveraged, crypto, providerSymbols };
    const ok = row ? await run(`/api/investing/watchlist/${row.id}`, { method: 'PATCH', body }) : await run('/api/investing/watchlist', { body: { symbol: symbol.trim(), exchange, ...body } });
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={row ? tw('edit') : tw('add')} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={tw('symbol')} value={symbol} maxLength={20} autoCapitalize="characters" onChange={(e) => setSymbol(e.target.value.toUpperCase())} disabled={!!row} error={fieldError('symbol')} autoFocus={!row} />
          <SelectField label={tw('exchange')} value={exchange} onChange={(e) => setExchange(e.target.value as Exchange)} disabled={!!row}>
            {EXCHANGES.map((x) => (
              <option key={x} value={x}>
                {EXCHANGE_INFO[x].label}
              </option>
            ))}
          </SelectField>
        </div>
        {row && <p className="-mt-2 text-sm text-ink-2">{tw('fixedListing')}</p>}
        <TextField label={tc('name')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} error={fieldError('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={tw('isin')} value={isin} maxLength={12} autoCapitalize="characters" onChange={(e) => setIsin(e.target.value.toUpperCase())} error={fieldError('isin')} />
          <SelectField label={tw('currency')} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {TRADING_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
          <SelectField label={tw('type')} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {INSTRUMENT_TYPES.map((x) => (
              <option key={x} value={x}>
                {tw(`types.${x}`)}
              </option>
            ))}
          </SelectField>
          <SelectField label={tw('region')} value={region} onChange={(e) => setRegion(e.target.value as typeof region)}>
            {REGIONS.map((x) => (
              <option key={x} value={x}>
                {tw(`regions.${x}`)}
              </option>
            ))}
          </SelectField>
          <TextField label={tw('domicile')} hint={tw('domicileHint')} value={domicile} maxLength={2} autoCapitalize="characters" onChange={(e) => setDomicile(e.target.value.toUpperCase())} error={fieldError('domicile')} />
          <TextField label={tw('ter')} hint={tw('terHint')} inputMode="decimal" value={ter} onChange={(e) => setTer(e.target.value)} error={Number.isNaN(terBps) ? tc('invalid') : fieldError('terBps')} />
        </div>
        <div className="border-y border-rule">
          <Switch label={tw('coreLabel')} description={tw('coreHint')} checked={core} onChange={setCore} />
          <Switch label={tw('leveraged')} checked={leveraged} onChange={setLeveraged} />
          <Switch label={tw('crypto')} checked={crypto} onChange={setCrypto} />
        </div>
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-accent hover:underline">{tw('providerSymbols')}</summary>
          <p className="mb-3 text-sm text-ink-2">{tw('providerHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {PROVIDERS.map((p) => (
              <TextField key={p} label={PROVIDER_LABELS[p]} value={symbols[p] ?? ''} maxLength={20} onChange={(e) => setSymbols((s) => ({ ...s, [p]: e.target.value.toUpperCase() }))} error={fieldError(`providerSymbols.${p}`)} />
            ))}
          </div>
        </details>
        {error && !error.fields && <Notice tone="danger">{tc('saveFailed')}</Notice>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} loading={busy} disabled={!valid}>
            {tc('save')}
          </Button>
          {row &&
            (confirming ? (
              <span className="ml-auto flex flex-wrap items-center gap-3">
                <span className="text-sm text-ink-2">{tw('removeConfirm', { symbol: row.symbol })}</span>
                <Button variant="danger" onClick={async () => (await run(`/api/investing/watchlist/${row.id}`, { method: 'DELETE' })) && onClose()}>
                  {tw('remove')}
                </Button>
              </span>
            ) : (
              <Button variant="danger" className="ml-auto" onClick={() => setConfirming(true)}>
                {tw('remove')}
              </Button>
            ))}
        </div>
      </div>
    </Sheet>
  );
}

function ManualPriceForm({ row, today, onClose }: { row: WatchlistRow; today: string; onClose: () => void }) {
  const tw = useTranslations('investing.watchlist');
  const tc = useTranslations('common');
  const { run, busy, error } = useAction();
  const [date, setDate] = useState(today);
  const [price, setPrice] = useState('');
  const micros = parsePrice(price);
  return (
    <Sheet open onClose={onClose} title={tw('manualTitle', { symbol: row.symbol })} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        <p className="text-ink-2">{tw('manualHint', { currency: row.currency })}</p>
        <TextField label={tc('date')} type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <TextField
          label={tw('priceLabel', { currency: row.currency })}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={price.trim() && micros === null ? tw('invalidPrice') : undefined}
          className="num"
        />
        {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
        <Button size="lg" loading={busy} disabled={micros === null} onClick={async () => (await run('/api/investing/manual-prices', { body: { watchlistId: row.id, localDate: date, priceMicros: micros } })) && onClose()}>
          {tc('save')}
        </Button>
      </div>
    </Sheet>
  );
}
