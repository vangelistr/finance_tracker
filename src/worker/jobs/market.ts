import type { Db } from 'mongodb';
import { toLocalDate, weekdayOf, zonedInstant } from '@/lib/dates';
import { DIGEST_TIME, REFRESH_SLOTS, REFRESH_TIMEZONE, isStale } from '@/lib/investing/calendar';
import { collectionsOf } from '@/server/db/collections';
import { env } from '@/server/env';
import { createProviders } from '@/server/market/providers';
import { refreshMarket, type RefreshDeps } from '@/server/market/refresh';
import { loadInsights } from '@/server/services/investing';
import { notify } from '@/server/notify';
import type { PushSender } from '@/server/push/send';
import type { Job } from '../scheduler';

// Investing module jobs. Both return before touching any provider when no user has the module on, so a server
// without the module makes no market-data calls at all (tested).

const DIGEST_WINDOW_MS = 12 * 60 * 60 * 1000;

function defaultDeps(): RefreshDeps {
  const e = env();
  return { providers: () => createProviders(e, fetch), http: fetch, fxBaseUrl: e.FX_BASE_URL };
}

export function marketRefreshJob(deps: () => RefreshDeps = defaultDeps): Job {
  return {
    name: 'market-refresh',
    async run({ db, now }: { db: Db; now: Date }) {
      const c = collectionsOf(db);
      const users = await c.users.find({ 'settings.investingEnabled': true }, { projection: { _id: 1 } }).toArray();
      if (users.length === 0) return;
      await refreshMarket(c, users.map((u) => u._id), deps(), now);
    },
  };
}

/**
 * Daily digest (off by default): from 08:00 local, Tuesday to Saturday (after a US session), once the morning
 * refresh has attempted every listing on the user's watchlist. Lists the top-ranked symbols with the data date.
 */
export function marketDigestJob(sender: PushSender): Job {
  return {
    name: 'market-digest',
    async run({ db, now }: { db: Db; now: Date }) {
      const c = collectionsOf(db);
      const users = await c.users.find({ 'settings.investingEnabled': true, 'settings.notifications.marketDigest.enabled': true }).toArray();
      for (const user of users) {
        const today = toLocalDate(now, user.timezone);
        const weekday = weekdayOf(today);
        if (weekday === 1 || weekday === 7) continue;
        const slot = zonedInstant(today, DIGEST_TIME, user.timezone).getTime();
        if (now.getTime() < slot || now.getTime() >= slot + DIGEST_WINDOW_MS) continue;

        const list = await c.watchlist.find({ userId: user._id }).toArray();
        if (list.length === 0) continue;
        const morning = `${toLocalDate(now, REFRESH_TIMEZONE)}T${REFRESH_SLOTS[0]}`;
        const metas = new Map((await c.priceMeta.find({ _id: { $in: list.map((w) => w.instrumentKey) } }).toArray()).map((m) => [m._id, m]));
        const pending = list.some((w) => {
          const m = metas.get(w.instrumentKey);
          return isStale(m?.lastDate ?? null, w.exchange, now) && (m?.lastAttemptSlot ?? '') < morning;
        });
        if (pending) continue;

        const insights = await loadInsights(user, now);
        const top = insights.rows.filter((r) => r.rank !== null).slice(0, 3);
        const dates = insights.rows.map((r) => r.lastDate).filter((d): d is string => !!d).sort();
        await notify(
          c,
          sender,
          {
            user,
            key: `digest:${today}`,
            type: 'marketDigest',
            titleKey: 'digestTitle',
            bodyKey: top.length ? 'digestBody' : 'digestBodyEmpty',
            params: { symbols: top.map((r) => r.symbol).join(', '), date: dates.at(-1) ?? '—' },
            url: '/investing',
          },
          now,
        );
      }
    },
  };
}
