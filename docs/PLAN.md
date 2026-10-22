# Finance Tracker — Phase 0 plan

Written 2026-10-22 during Phase 0 (research and plan, no app code). Server specifics live only in the
local, gitignored `docs/SERVER-NOTES.md`; this file contains no server details.
Related: `docs/REQUIREMENTS.md` (requirement index), `docs/DECISIONS.md` (rationale), `docs/BLOCKERS.md`.

## 1. Goals and constraints in one screen

- Private, self-hosted personal finance PWA for one owner (more invited users possible), every user's data isolated.
- Greek UI by default with an English toggle, EUR, Europe/Athens. Money in integer minor units (cents). Instants in UTC.
- Reachable only through Tailscale (`tailscale serve`, HTTPS, never Funnel). The app port binds to 127.0.0.1 only.
- Optional investing module, off by default: zero market-data calls while off.
- Tax, allocation and ranking figures are always labelled as estimates or educational. Investing output is never a
  prediction or a buy/sell signal.
- Free tiers only. No telemetry. No third party receives user data, except encrypted backups to the user's own bucket.

## 2. Architecture

```
 phone / laptop (tailnet member)
        │  HTTPS, MagicDNS name, TLS cert from Tailscale
        ▼
 tailscale serve (on the host)  ──►  127.0.0.1:${APP_HOST_PORT}  (published by Compose, loopback only)
                                            │
  Compose project "finance", own bridge network "finance_net"
  ┌───────────────────────────────────────────────────────────────────────────────┐
  │ app     Next.js standalone server (RSC pages + /api route handlers), non-root   │
  │ worker  same image, `node dist/worker.mjs`: scheduler, push sender,            │
  │         recurring generation, monthly reports, market refresh (if enabled)     │
  │ mongo   official image, auth on, named volume, healthcheck, NO published port │
  │ backup  own image: mongodump → restic (local dir | S3/R2 | SFTP), cron in      │
  │         Europe/Athens, on-demand `backup-now` for deploys, writes run status   │
  └───────────────────────────────────────────────────────────────────────────────┘
        worker ──► Web Push services (VAPID)       worker ──► market-data APIs (only if enabled)
        backup ──► restic repository (local volume by default; R2 via S3 API when configured)
```

- **Rendering model:** pages are Server Components that read through the service layer with the session's user id.
  All writes go through `/api/*` route handlers (zod-validated, CSRF-checked) that the UI calls with `fetch`
  and that the offline expense queue replays. After a write the client calls `router.refresh()`.
- **One image, several commands:** `node server.js` (app), `node dist/worker.mjs` (worker),
  `node dist/migrate.mjs` (idempotent migrations), `node dist/admin.mjs` (password reset, TOTP reset, invites).
  Worker and scripts are esbuild bundles of the same TypeScript sources as the app.
- **Code layout:**

```
src/
  app/                  routes: (public) setup, login, invite; (app) dashboard and feature pages; api/*; offline
  proxy.ts              auth redirect, CSRF origin check, CSP nonce, security headers
  lib/                  pure, framework-free domain logic (money, dates, recurrence, calendar, aggregates,
                        budgets, goals, plan, tax, insights, validation schemas) — unit tested
  server/               server-only: env, db (client, collections, indexes, migrations), auth, services,
                        market (providers, chain, budget, cache, fx), push, http (single outbound client)
  worker/               clock, scheduler, jobs (reminders, monthly, renewals, overspend, reports, recurring,
                        market refresh, digest, backup alerts)
  components/           UI primitives, charts (SVG), forms, navigation, quick-add sheet
  i18n/                 next-intl request config + messages/el.json, messages/en.json
  cli/                  migrate and admin entry points (bundled to dist/)
  pwa/                  service worker template (build id injected into public/sw.js)
public/                 sw.js, icons, manifest assets
config/tax/             versioned per-tax-year rate configs (JSON, with sources and last-reviewed dates)
docker/backup/          backup image (Dockerfile, entrypoint, backup, restore, restore-test scripts)
docker/mongo-init/      first-start script that creates the app user
deploy/                 deploy.sh, rollback.sh, finance-updater.{service,timer}
scripts/                generate-vapid-keys, env checks, screenshot runner
tests/                  unit (vitest), integration (vitest + real Mongo), e2e (Playwright)
```

## 3. Stack and pinned versions (checked with `npm view` / registries on 2026-10-21)

| Area | Choice | Version |
|------|--------|---------|
| Runtime | Node.js LTS "Krypton" (image `node:24.22.1-trixie-slim`, pinned by digest) | 24.22.1 |
| Framework | Next.js (App Router, Turbopack, `output: 'standalone'`) | 16.4.2 |
| UI | React / React DOM | 19.3.1 |
| Language | TypeScript, `strict` (TS 7 not supported by typescript-eslint yet) | 6.0.3 |
| Database | MongoDB server (image `mongo:7.0.45-jammy`, D-036) / Node driver | 7.0.45 / 7.7.0 |
| Validation | zod | 4.6.7 |
| Auth primitives | `@node-rs/argon2` (argon2id), `otpauth` (TOTP), `qrcode` (enrolment QR) | 2.2.2 / 9.5.2 / 1.5.4 |
| Push | `web-push` (VAPID) | 3.6.7 |
| i18n | `next-intl` (no locale routing); `use-intl/core` for worker-side text | 4.14.9 |
| Dates | `date-fns` + `@date-fns/tz` | 4.4.0 / 1.5.0 |
| Styling | Tailwind CSS + `@tailwindcss/postcss` | 4.3.3 |
| Icons | `lucide-react` (one stroke family) | 1.61.0 |
| Tests | Vitest + coverage, Playwright test runner, axe-core for Playwright | 5.0.5 / 1.64.1 |
| Lint | ESLint + `eslint-config-next` (flat config) + typescript-eslint | 10.13.0 / 16.4.2 / 8.72.0 |
| Bundling scripts | esbuild | 0.28.2 |
| Backups | restic (pinned binary, checksum-verified), mongo tools from the mongo image | see §10 |

Every dependency is pinned to an exact version in `package.json` and logged with a one-line reason in
`docs/DECISIONS.md` when it is added. MongoDB 7.0 is used because 8.0/9.0 exit at start-up on Linux kernels 6.19–7.0.13 (D-036).

## 4. MongoDB collections and indexes

Rules: every user-owned document has `userId` and every query on it filters by `userId` first (repository layer
enforces it; the isolation test proves it). Money fields end in `Minor` and hold safe integers (cents).
Instants are UTC `Date`. Calendar dates are `localDate: 'YYYY-MM-DD'` in the user's time zone (default
Europe/Athens), with `month: 'YYYY-MM'` derived from it for grouping.

| Collection | Key fields | Indexes |
|------------|-----------|---------|
| `users` | email, name, passwordHash (argon2id), role owner/member, locale, currency, timezone, totp {enabled, secretEnc, lastStep}, settings {investingEnabled, notifications, plan, tax, investing}, onboardingDoneAt | `email` unique |
| `sessions` | `_id` = HMAC-SHA256 of token (key `SESSION_SECRET`), userId, expiresAt, lastSeenAt, `mfaPending` | TTL `expiresAt`; `userId` |
| `invites` | `_id` = HMAC-SHA256 of token, createdBy, expiresAt, usedAt, usedBy | TTL `expiresAt` |
| `rate_limits` | `_id` = scope key (ip / account), count, expiresAt | TTL `expiresAt` |
| `app_meta` | `setup` (completedAt, ownerId), `worker` heartbeat | `_id` |
| `migrations` | `_id` = migration id, appliedAt | `_id` |
| `accounts` | userId, name, type checking/cash/savings/investment/bills/tax_reserve, currency, openingBalanceMinor, openingDate, archived, sort | `{userId, archived, sort}` |
| `categories` | userId, kind expense/income, name, parentId (subcategory), color token, icon, essential, archived, sort, seedKey | `{userId, kind, parentId, sort}`; unique `{userId, kind, parentId, name}` (case-insensitive collation) |
| `income_sources` | userId, name, type recurring_fixed/recurring_variable/one_time, categoryId, currency, accountId, schedule, expectedNetMinor, expectedGrossMinor, freelance, active | `{userId, active}` |
| `recurring_expenses` | userId, name, amountMinor, categoryId, accountId, schedule, subscription {status active/paused/cancelled, reminderDaysBefore}, active | `{userId, active}` |
| `transactions` | userId, kind income/expense/transfer, status expected/done/skipped, amountMinor (net), grossMinor, accountId, toAccountId, categoryId, incomeSourceId, recurringExpenseId, occurredAt, localDate, month, note, origin manual/generated/offline/tax_set_aside, occurrenceKey, clientId, invoice {netMinor, vatMinor, withheldMinor}, taxSetAside {sourceTransactionId, parts} | `{userId, localDate:-1}`; `{userId, month, kind}`; `{userId, categoryId, month}`; unique partial `{userId, occurrenceKey}`; unique partial `{userId, clientId}`; unique partial `{userId, taxSetAside.sourceTransactionId}` |
| `budgets` | userId, categoryId (null = overall), amountMinor | unique `{userId, categoryId}` |
| `goals` | userId, name, targetMinor, deadline, accountId, priority, isEmergencyFund, archived | `{userId, archived, priority}` |
| `goal_contributions` | userId, goalId, amountMinor, localDate, source manual/plan, planMonth | `{userId, goalId, localDate}`; unique partial `{userId, goalId, planMonth}` (one plan contribution per goal per month) |
| `push_subscriptions` | userId, endpoint, keys, userAgent, lastSuccessAt, failureCount | unique `endpoint`; `userId` |
| `notification_log` | userId, key, type, status sending/sent/failed/no_subscription, createdAt | unique `{userId, key}`; TTL `createdAt` 400 days |
| `notifications` | userId, type, titleKey, params, url, createdAt, readAt (in-app banner fallback) | `{userId, readAt, createdAt}`; TTL 90 days |
| `reports` | userId, month, generatedAt, schemaVersion, data (immutable snapshot) | unique `{userId, month}` |
| `tax_configs` | userId, taxYear, config (rates with sources), edited, updatedAt (seeded from `config/tax/<year>.json`) | unique `{userId, taxYear}` |
| `backup_runs` | kind backup/check/restore-test, trigger schedule/manual/pre-deploy, status, startedAt, finishedAt, durationMs, snapshotId, countsBefore, countsAfter, offsite, error, notifiedAt | `{startedAt:-1}` (ops data, no user data) |
| `watchlist` | userId, symbol, exchange, isin, name, currency, type stock/etf, region, domicile, terBps, core, leveraged, crypto, providerSymbols | unique `{userId, symbol, exchange}` |
| `manual_prices` | userId, instrumentKey, localDate, priceMinor, currency | unique `{userId, instrumentKey, localDate}` |
| `prices` (shared, public data) | instrumentKey, date, close, adjClose, currency, provider, fetchedAt, expiresAt | unique `{instrumentKey, date}`; TTL `expiresAt` |
| `price_meta` (shared) | instrumentKey, lastDate, provider, fetchedAt, lastError | `_id` |
| `fx_rates` (shared) | date, base EUR, rates, fetchedAt, expiresAt | `_id` = date; TTL `expiresAt` |
| `provider_usage` (shared) | provider, day (provider reset day), calls | `_id` = `provider:day`; TTL 7 days |

Collections marked "shared" hold only public market data or operations data, never user data.

## 5. Pages and API

### Pages (all behind auth unless marked public)

| Path | Purpose |
|------|---------|
| `/setup` (public, only while no user exists) | Wizard: owner account → language/currency/time zone → investing module on/off |
| `/login` (public), `/login/2fa` | Password login, then TOTP step when enabled |
| `/invite/[token]` (public) | Register through an owner-issued invite |
| `/onboarding` | Income sources → categories → accounts → notification permission |
| `/` | Dashboard: month ledger line, budgets, donuts, income vs expenses bars, net worth line, coming up |
| `/transactions` | List, filters, add/edit/delete, quick-add |
| `/income` | Income sources (3 types) and entries (expected → received) |
| `/fixed` | Fixed recurring expenses and subscriptions |
| `/accounts` | Accounts, balances, transfers, tax reserve bucket |
| `/calendar` | Month grid (desktop) / agenda (mobile), day sheet with add/confirm |
| `/budgets` | Category and overall monthly budgets with progress |
| `/goals` | Savings goals, contributions, required monthly amount, projected date |
| `/plan` | Smart Plan: inputs, formula, split, overrides, disclaimer |
| `/reports`, `/reports/[month]` | Month-end report history and print-friendly snapshot |
| `/tax` | Tax/EFKA estimator: profile, per-invoice/month/year set-aside, versioned rate config with sources |
| `/investing/*` (only when enabled) | Watchlist, daily ranking, monthly suggestion, risk questionnaire, guardrails, data status |
| `/settings` | Profile, language, password, TOTP, notifications and push devices, invites (owner), investing toggle, backup status (owner) |
| `/offline` (public, static) | Offline shell with the offline expense queue |

### API (JSON, all mutations zod-validated, session + CSRF required unless marked)

```
GET  /api/health                         liveness, {status:"ok"}                     (public)
GET  /api/ready                          DB ping + worker heartbeat age, minimal JSON (public)
POST /api/auth/setup                     create owner (only when no user exists)      (public + CSRF)
POST /api/auth/login | /api/auth/login/totp | /api/auth/logout                        (login: public + CSRF)
POST /api/auth/register                  with invite token                            (public + CSRF)
POST /api/auth/password | /api/auth/totp/{start,enable,disable}
GET|POST /api/invites   DELETE /api/invites/:id                                       (owner)
GET|PATCH /api/settings
GET|POST /api/accounts            PATCH|DELETE /api/accounts/:id     POST /api/transfers
GET|POST /api/categories          PATCH|DELETE /api/categories/:id
GET|POST /api/income-sources      PATCH|DELETE /api/income-sources/:id
GET|POST /api/transactions        PATCH|DELETE /api/transactions/:id
POST /api/transactions/:id/confirm      expected → received/paid
POST /api/transactions/:id/skip         skip a generated occurrence
GET|POST /api/recurring-expenses  PATCH|DELETE /api/recurring-expenses/:id
GET|PUT  /api/budgets
GET  /api/calendar?month=YYYY-MM
GET  /api/dashboard?from=YYYY-MM&to=YYYY-MM
GET|POST /api/goals  PATCH|DELETE /api/goals/:id  POST /api/goals/:id/contributions
GET  /api/plan?month=YYYY-MM   PUT /api/plan/settings   POST /api/plan/apply
GET  /api/reports   GET /api/reports/:month
GET|PUT /api/tax/profile   GET|PUT /api/tax/config/:year   GET /api/tax/estimate?year=&month=
POST /api/tax/set-aside/:transactionId
GET|POST /api/investing/watchlist  PATCH|DELETE /api/investing/watchlist/:id     (404 when module off)
GET  /api/investing/ranking   GET /api/investing/suggestion?month=   PUT /api/investing/profile
POST /api/investing/manual-prices   GET /api/investing/status
POST /api/push/subscribe | /api/push/unsubscribe | /api/push/test
GET  /api/notifications   POST /api/notifications/:id/read
GET  /api/offline/bootstrap        categories + accounts for the offline quick-add
```

Errors use one shape: `{ "error": { "code": "...", "message": "...", "fields": {...} } }` with 400/401/403/404/409/429.
Responses never echo internal ids of other users, stack traces or configuration.

## 6. Domain logic specifications

### 6.1 Recurrence, generation and the calendar

- A schedule is `{frequency: weekly|biweekly|monthly|quarterly|yearly, interval, dayOfMonth, weekday, month,
  startDate, endDate}`. Occurrences are computed as local dates. `dayOfMonth` 29–31 clamps to the month's last day.
- Recurring fixed income sources and recurring expenses (incl. subscriptions) generate `expected` transactions
  for the current and next month. The worker runs generation daily per user; pages that need a month also call it.
  Idempotency: `occurrenceKey = <kind>:<sourceId>:<localDate>` with a unique index and an upsert with
  `$setOnInsert`. Skipped occurrences keep their row (`status: skipped`) so they are never regenerated.
- Paused or cancelled subscriptions stop generating. A subscription's renewal date is its next occurrence.
- The calendar for a month merges stored transactions with projected (not yet generated) occurrences, renewal
  markers and goal contributions, grouped by `localDate`. Because grouping uses the stored local date, items at
  00:30 on the 1st never fall into the previous month, and DST changes (last Sundays of March and October) never
  move an item to another day. Tests cover both boundaries and both DST transitions.

### 6.2 Dashboard aggregates and budgets

Pure functions over a date range: expenses by category (donut), income by source (donut), income vs expenses
per month (bars), net worth per month end (line: opening balances + cumulative done transactions; expected items
excluded), budget progress per category and overall (done expenses only, current month). Fixture tests assert
every chart's totals. Overspend thresholds default to 80 % and 100 % (user-configurable).

### 6.3 Savings goals

For goal G with target T, saved S (sum of contributions), today D, optional deadline L:
- progress = S / T (capped at 100 % for display);
- months left m = whole calendar months from D's month to L's month, minimum 1; required monthly = ceil((T − S) / m);
- pace = average monthly contribution over the last 3 calendar months (0 if none); projected date = D + ceil((T − S) / pace)
  months when pace > 0, otherwise "no projection". Unit tests cover past deadlines, reached targets and zero pace.

### 6.4 Smart Plan

Full method, sources and worked examples: `docs/allocation-methodology.md` (section 3 is the specification).
Pure functions in `src/lib/plan/`; every output carries its inputs, the formula text and the disclaimer
"educational, not financial advice". Defaults live in `users.settings.plan` and every one is user-overridable.

- **Baseline** `B = F + V`. `F` = monthly equivalent of the expected net amounts of active `recurring_fixed` sources.
  `V` = the **minimum** monthly total of received `recurring_variable` income over the last up to 6 complete months
  (zero months count as 0); confidence `none` / `provisional` (1–2 months) / `partial` (3–5) / `full` (6); a manual
  value can replace it. `one_time` income never enters `B`; median and mean are shown for information.
- **Essentials** `E` = essential fixed costs (monthly equivalent) + per essential category `max(3-month average, budget)`.
- **Profile**: irregular when variable + one-time income is at least 25 % of the last 6 months' received income.
  Emergency-fund target = `E × 3` (fixed) or `E × 6` (irregular), or the emergency-fund goal's own target.
- **Split of `B`** (integer cents, sums exactly to `B`): essentials first (`min(E, B)`); discretionary 30 %; investing
  10 % (0 allowed), held at 0 until the emergency fund holds 3 months of essentials (gate can be turned off);
  savings is the balance. Squeeze order when tight: essentials, a 5 % savings floor, discretionary, investing.
  `E ≥ B` is deficit mode: essentials take all of `B` and the shortfall is shown.
- **Savings routing**: emergency fund first, then goals by priority, then deadline; a deadline goal claims
  `ceil(remaining / months left)`; spare money fills goals; flags `deadline_at_risk` and `deadline_passed`.
- **Surplus** (received above `B` in the month): tax reserve estimate, 10 % free spending, emergency fund, goals,
  investing (capped at the monthly investing amount, gate open), then uncommitted.
- **Rounding**: `floor` for percentages, savings as the balance; displayed percentages by largest remainder.
- **Tests**: the four worked examples, every edge case in section 5 of the methodology, and a property test
  (random inputs: parts ≥ 0, sum = `B`).

### 6.5 Tax/EFKA estimator

Research, sources (official only) and worked example: `docs/research/tax-efka.md`. Rates live in versioned
per-year configs `config/tax/2025.json` and `config/tax/2026.json` (from section 9 of that file: every block has a
source id, a last-reviewed date and an `uncertain` flag), seeded per user into `tax_configs` and editable in the UI.
No rate appears in code. Pure functions in `src/lib/tax/`.

- **Income tax**: one scale for employment and business profit. 2025: 9/22/28/36/44 %. 2026 (law 5246/2025):
  9/20/26/34/39/44 % with optional child and age rates. Business profit is stacked on the user's other annual
  taxable income (an input); the employment reduction (art. 16) is prorated to the employment share [uncertain].
- **Reserve event model**: `Reserve(t) = tax(E + B(t)) − tax(E)`; each invoice reserves the marginal delta, so month
  and year totals telescope exactly. EFKA accrues monthly and reduces business profit.
- **EFKA**: 2026 classes 1–6 and the new-professional special class (first 5 years); parallel salaried employment
  offsets the main contribution by a user-entered amount [uncertain]; contributions are deductible.
- **VAT**: 24 % standard; small-business exemption at €10,000 Greek turnover (previous and current year); the
  crossing invoice carries VAT in full and the UI warns.
- **Prepayment**: 55 % of the business-income tax, halved only in the first year business income is declared;
  fees withheld at 20 % are excluded. Shown as a cash line for next year, not extra tax.
- **Withholding**: 20 % on qualifying fees above €300 paid by businesses; credited at year end; not netted from the
  reserve at invoice time (conservative).
- **Set-aside**: VAT + income-tax delta move to the tax reserve bucket at the invoice; EFKA at month end
  (`taxSetAside` transactions, idempotent per source transaction).
- **UI**: every figure says "estimate, not tax advice; confirm with an accountant"; every [uncertain] item from the
  research list is shown next to the number it affects. Tests: the worked example (both VAT scenarios), bracket
  edges, the VAT crossing invoice, EFKA with and without parallel employment, prepayment first-year halving.

### 6.6 Investing insights (ranking and monthly split)

Inputs per instrument: daily adjusted closes (newest last), converted to EUR for display only; metrics use the
instrument's own currency so FX noise does not distort returns.

| Metric | Definition (trading days) | Missing data |
|--------|---------------------------|--------------|
| r1m, r3m, r6m, r12m | close_t / close_{t−n} − 1, n = 21, 63, 126, 252 | null if fewer than n+1 closes |
| volatility | stdev of daily log returns over the last 252 days × √252 | null if fewer than 60 returns |
| max drawdown | max over the last 252 days of (peak − trough) / peak | null if fewer than 60 closes |
| trend | close / SMA200 − 1 | null if fewer than 200 closes |
| risk-adjusted | r12m / volatility | null if either is null or volatility = 0 |
| cost | TER entered by the user (basis points), lower is better | null if not entered |

Scoring: each metric is converted to a percentile rank within the universe (higher is better; volatility,
drawdown and cost inverted). The score is the weighted mean of the available percentiles with user-adjustable
weights (defaults: r12m 20, r6m 15, r3m 10, r1m 5, risk-adjusted 20, volatility 10, drawdown 10, trend 5,
cost 5). An instrument with fewer than half of the weight available is listed as "insufficient data" and never
included in the split. Ties break by lower volatility, then symbol. Every row shows its raw numbers and
which weights produced the score.

Monthly split of the investing amount A (from the Smart Plan), deterministic, integer cents:
1. Eligible = ranked instruments with sufficient data, excluding leveraged and crypto unless enabled, limited to
   the top N (N from the risk profile: conservative 3, balanced 5, growth 7).
2. Core share: at least `coreMinPct` (risk profile: 80 / 60 / 40 %) goes to instruments flagged `core`
   (broad-market ETFs), split by score.
3. The rest goes to the remaining eligible instruments by score.
4. Caps: `maxPerInstrumentPct`, `maxPerRegionPct`, `maxPerCurrencyPct` (defaults 40 / 70 / 80 %, adjustable).
   A water-filling loop moves any excess to the next uncapped instrument by score. If every instrument is capped,
   the remainder is shown as "unallocated (caps reached)", so the lines always sum exactly to A.
5. Rounding: floor each line, then hand out the remaining cents by score order.
Every result shows inputs, weights, caps, data timestamps, provider, staleness, and the text:
"Ranked by past-performance criteria; past performance does not predict future results; educational, not
financial advice." Unit tests: known fixtures, missing data, ties, caps, infeasible caps, sum = A.

### 6.7 Month-end report

Generated once per user for each closed month (the worker on the 1st, or lazily when the history page finds a
closed month without a report). The insert relies on the unique `{userId, month}` index, so a second attempt is a
no-op. The snapshot stores computed figures, not references: income vs expenses, savings rate, top categories,
budget adherence, month-over-month change, goal progress, next month's expected renewals and tax reserve status.
No update endpoint exists. The page has a print stylesheet (A4, no navigation, light colours).

## 7. Worker and notifications

- `Clock` interface (`now()`); production uses the system clock, tests use a fake clock. The worker loop calls
  `tick(clock.now())` every 30 s and writes a heartbeat (`app_meta.worker`, also a file for the container
  healthcheck). `/api/ready` fails when the heartbeat is older than 3 minutes.
- Jobs per tick (each user evaluated in their own time zone):

| Job | When (defaults, configurable) | Idempotency key |
|-----|------------------------------|-----------------|
| Daily reminder | 21:00 local, sent if the tick falls within 2 h after the slot | `daily:<localDate>` |
| Monthly flow | 1st of month 09:00 local: ensure last month's report, then one push linking to the report, a pre-filled income form with expected recurring incomes, and (if investing on) the monthly suggestion | `monthly:<YYYY-MM>` |
| Renewal alert | N days (default 3, per subscription) before the renewal date, at 09:00 local | `renewal:<subscriptionId>:<renewalDate>` |
| Overspend | When month-to-date spending crosses a threshold (default 80 %, 100 %) per category and overall | `overspend:<categoryId or overall>:<YYYY-MM>:<threshold>` |
| Recurring generation | Every hour (cheap, idempotent) | unique occurrence keys |
| Market refresh | 07:30 local, Tuesday to Saturday, retry 12:30 for stale symbols (investing users only) | `market:<US trading date>` (global) |
| Market digest | 08:00 local after a successful refresh, only if the user enabled it (off by default) | `digest:<localDate>` |
| Backup failure alert | A failed `backup_runs` entry without `notifiedAt`, or no success in 26 h | `backup:<runId>` |

- Delivery: insert the `notification_log` row first (unique key), then send Web Push to every subscription of
  the user with `web-push` (VAPID from `.env`), and always add an in-app `notifications` row for the banner.
  Subscriptions answering 404/410 are deleted. Per-type on/off toggles live in user settings.
- iOS: push works only after the PWA is added to the Home Screen (iOS/iPadOS 16.4+), and permission must be
  requested from a user gesture (WebKit blog "Web Push for Web Apps on iOS and iPadOS", read 2026-10-22).
  The settings page explains this when it detects iOS outside standalone mode.

## 8. Investing data: providers, chain, refresh

Verified limits, coverage, endpoints and the live checklist: `docs/MARKET-DATA.md` (verified 2026-10-22).
Module off by default; while off, the market client is never constructed and a test asserts zero outbound calls.

- **Chain per instrument** (provider-agnostic adapter, `src/server/market/`): US-listed stocks/ETFs → Twelve Data
  `time_series` → EODHD → FMP → Alpha Vantage → Finnhub `/quote` (sanity only) → manual price. LSE/Xetra/Euronext →
  EODHD (probe) → Alpha Vantage (probe) → manual. No free provider is confirmed for UCITS listings, so manual entry is
  the guaranteed path for them until the live check runs (`docs/BLOCKERS.md` B-003).
- **Outcome cache per (instrument, provider)**: `not_covered` skips that provider for 30 days; 429/402/quota bodies
  stop the provider until its reset (Twelve Data and EODHD: midnight UTC/GMT); `error` retries after an hour.
- **Budgets per day** (80 % of the hard limit): Twelve Data 640 credits (6/min), EODHD 16, FMP 200, Alpha Vantage 20,
  Finnhub 300 (30/min). Counters in `provider_usage`, keyed by the provider's reset day. Universe guard: warn above
  30 instruments, block above 40.
- **Refresh**: one job at 07:30 Europe/Athens, Tuesday to Saturday, retry at 12:30 for stale symbols; expected last
  close from an exchange calendar (NYSE holidays 2026–2027 in the doc); request a 10-day window so gaps heal for free;
  catch-up at worker start. Never intraday.
- **FX**: Frankfurter v2 with `providers=ECB` (v1 is deprecated but available), one call a day, cached 24 h; last known
  rate with its date on failure. Returns are computed in the instrument's currency; EUR is for display.
- **Stored per price**: source, bar date (exchange local), `fetchedAt` (UTC), currency, adjusted flag. Staleness label
  after one missed expected close.
- **Starter watchlist** (editable, 10 rows): IWDA, VWCE, SXR8, IS3N, AGGH (UCITS) and VT, VTI, AAPL, MSFT, AMZN
  (US-listed; VT and VTI carry the EU-retail availability note).

## 9. Security design

- **Passwords:** argon2id with memory 19 MiB (19456 KiB), 2 iterations, parallelism 1 — the OWASP Password Storage
  Cheat Sheet minimum (read 2026-10-22) — via `@node-rs/argon2`; length 12–128 (the upper bound limits hashing cost).
- **Sessions:** 32 random bytes, cookie `__Host-ft_session` over HTTPS (`ft_session` on local http), `HttpOnly`,
  `Secure`, `SameSite=Lax`, `Path=/`; only the HMAC-SHA256 of the token (key `SESSION_SECRET`) is stored. 30-day sliding expiry, rotated on
  login and privilege change, deleted on logout and password change.
- **CSRF:** `proxy.ts` rejects POST/PUT/PATCH/DELETE when `Origin` is missing or differs from `APP_URL`'s origin;
  the client sends `x-csrf-token` equal to the `ft_csrf` cookie (double submit), compared in constant time.
- **Rate limiting:** login and TOTP attempts: 5 per 15 min per account and 20 per 15 min per client IP
  (Mongo counters with TTL); 429 with `Retry-After`.
- **TOTP:** RFC 6238 (SHA-1, 6 digits, 30 s, ±1 step), secret encrypted with AES-256-GCM (`DATA_ENCRYPTION_KEY`),
  replay blocked by storing the last used step. Admin CLI can disable it for recovery.
- **Registration:** only `/setup` while no user exists, then invites only (single use, 7-day expiry, hashed).
- **Validation and NoSQL safety:** zod `strictObject` on every body and query; ids parsed to `ObjectId` or 404;
  no user-supplied object ever reaches a query as an operator; the repository layer builds every filter.
- **Isolation:** every repository function requires `userId`; tests prove user A cannot read, update or delete user
  B's documents through the services and through the HTTP API.
- **Headers:** nonce-based CSP from `proxy.ts` (`default-src 'self'`, `script-src 'self' 'nonce-…' 'strict-dynamic'`,
  `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, `connect-src 'self'`, `worker-src 'self'`,
  `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`), HSTS over HTTPS,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera, microphone,
  geolocation off), `Cross-Origin-Opener-Policy: same-origin`.
- **Secrets:** only in `.env` (gitignored). Env is validated with zod at start-up; errors name the variable, never
  the value. Logs never contain secrets, tokens, amounts or personal data.
- **Outbound HTTP:** one `http` module is the only place that calls `fetch` to the internet (push services,
  market data, FX). Market-data calls carry only symbols and dates. A test fails if it is called while the
  investing module is off.
- **Supply chain:** exact versions, `npm ci`, `npm audit --audit-level=critical` in CI, Dependabot, actions pinned
  by full SHA, image scan with Trivy.

## 10. Backup design

Research and full design: `docs/research/backup-r2-restic.md` (section 7 is the build specification).

- **Image** `docker/backup/`: builder stage downloads restic 0.19.1 and verifies the GPG signature and the pinned
  SHA-256; final stage `FROM mongo:7.0.45-jammy` (mongodump/mongorestore/mongosh/mongod included) plus
  `openssh-client`. No Docker socket, no published port, `TZ=Europe/Athens`.
- **Backup**: `mongodump --db finance --archive` (no `--gzip`, so restic can deduplicate and compress) streamed into
  `restic backup --stdin-from-command --stdin-filename finance.archive --host finance-tracker --tag mongodb`.
  Per-collection counts are recorded before and after the dump.
- **Targets** by `BACKUP_TARGET`: `local` (default, tested), `s3` (Cloudflare R2:
  `s3:https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>/restic` with `s3.bucket-lookup=path`, `s3.region=auto`;
  private bucket, single-bucket Object Read & Write token), `sftp` (Hetzner Storage Box, port 23, pinned host key).
- **Schedule**: a catch-up loop (daily at `BACKUP_SCHEDULE` local time, safe on DST nights), then
  `forget --prune` with 7 daily / 4 weekly / 6 monthly. First night of each month: `check --read-data` and
  `restore-test`. Everything under one `flock`.
- **Scripts**: `backup`, `backup-now` (pre-deploy, no prune, non-zero on failure), `restore` (requires `--yes`, takes a
  safety snapshot first), `restore-test` (temporary `mongod` inside the container, restore into `restore_test.*`,
  compare per-collection counts and indexes), `check`, `status`.
- **Status and alerts**: `backup_runs` rows (`kind`, `trigger`, `status`, counts, `offsite`, `durationMs`) plus
  `/var/lib/backup/status.json`; container healthcheck fails after 26 h without success; the worker sends the push
  and banner alert (`backup:<runId>`).
- **Start-up validation** (exit 78, variable names only): target known; `RESTIC_PASSWORD` ≥ 20 characters; `s3`
  needs an `https://…r2.cloudflarestorage.com` endpoint with no path (r2.dev rejected) and all credentials; `sftp`
  needs key and known-hosts files; then `restic cat config` as a probe.
- **Free tier**: worst case about 0.85 GB stored and a few thousand operations a month, well inside R2's
  10 GB-month, 1M Class A and 10M Class B. Infrequent Access is not used.
- **New variables** (added to `.env.example` and `.env` in Phase 1): `BACKUP_HOST`, `BACKUP_REPO_PREFIX`,
  `SFTP_KNOWN_HOSTS_FILE`, `BACKUP_TIMEOUT_MINUTES`, `BACKUP_STALE_HOURS`.

## 11. CI/CD design

Limits, pinned SHAs, security-tool notes and the minutes estimate: `docs/research/github-ci-limits.md`.

- **Free plan, private repo**: 2,000 Linux minutes a month (per-job rounding up), 500 MB shared artifact/package
  storage, 10 GB Actions cache per repo, GHCR currently free. No payment method, so CI stops instead of billing.
  `actions/attest-build-provenance` is not available on Free private repos; BuildKit provenance (`mode=max`) and
  SBOM on pushed images are used instead (`docs/BLOCKERS.md`).
- **`ci.yml`** (pull requests and pushes to `main` and `build/**`; `permissions: {}` at the top, `contents: read` per
  job, `concurrency` cancel-in-progress per ref, `timeout-minutes` everywhere, all actions pinned by SHA,
  `persist-credentials: false`). Docs-only changes skip work through a `changes` job, not trigger `paths-ignore`,
  so required checks never hang:
  - `static`: lint, typecheck, `npm audit --audit-level=critical`, actionlint (checksum-pinned binary);
  - `test`: Vitest unit + integration with a `mongo:7.0.45-jammy` service container;
  - `secrets`: gitleaks 8.30.1 (checksum-pinned binary, full history);
  - `image`: buildx build (`type=gha` cache), Trivy 0.76.1 binary (CRITICAL only, `.trivyignore`), and from Phase 2
    the e2e smoke (Playwright against `docker compose`) on pull requests and `main`;
  - `ci-success`: `if: always()`, fails when any needed job failed or was cancelled — the single required check.
- **`release.yml`** (push to `main`, tags `v*`): calls `ci.yml` via `workflow_call`, then `publish` (the only job with
  `packages: write`) builds for linux/amd64 and pushes to GHCR with tags `sha-<7>`, `main`, `X.Y.Z`, `X.Y`
  (`latest` disabled), OCI labels from `docker/metadata-action`.
- **Dependabot**: npm, docker and github-actions, weekly, minor and patch grouped.
- **Budget**: merged layout ≈ 18 min warm / 26 min cold per push; ≈ 1,400 min/month for 60 pushes, 10 releases and
  Dependabot (≈ 70 % of the allowance).
- **Deploy** (pull-based, `deploy/`): the server pulls an immutable `sha-` tag with a `read:packages` token stored only
  on the server. `deploy.sh`: pre-deploy backup → pull → migrations → `up -d` → `/api/ready` gate → automatic rollback
  on failure → record tag → keep the last 3 images. Branch protection on a Free private repo is not confirmed to be
  available; it is a manual recommendation in the README.

## 12. PWA

- `app/manifest.ts`: name, short name, Greek description, `display: standalone`, theme and background colours from
  the tokens, icons 192/512 (any + maskable) and an Apple touch icon.
- `public/sw.js` (hand-written, versioned cache names):
  - precache the offline shell (`/offline`, its JS/CSS chunks, fonts, icons);
  - `/_next/static/*` cache-first (immutable, hashed); navigations network-first with the offline shell as fallback;
    API calls never cached;
  - offline queue: the quick-add form stores expenses in IndexedDB with a client UUID when offline or when the POST
    fails with a network error; the queue replays on `online`, on app start and through Background Sync where
    supported. The server de-duplicates by `{userId, clientId}`, so a replay never creates a duplicate;
  - `push` shows the notification; `notificationclick` focuses or opens the target URL.
- Installability is checked in Playwright (manifest fields, service worker registered and controlling the page).

## 13. Testing and acceptance mapping

| Acceptance item | Proof |
|-----------------|-------|
| Compose up healthy, mongo unpublished, app on 127.0.0.1 | `docker compose up -d --build`, `docker compose ps` health, `docker port` output |
| Setup wizard, closed registration, redirects, A/B isolation | e2e (fresh DB) + integration tests (services and HTTP) |
| Income types, categories, accounts, subscriptions; generation exactly once | integration tests (idempotency: run twice, same count) |
| Calendar across month boundaries and DST | unit tests in Europe/Athens |
| Charts match fixture totals | unit tests on aggregate functions |
| Daily and monthly pushes on time, no duplicates; renewal and overspend once | fake-clock worker tests with a recording push sender |
| Goals, Smart Plan, tax, insights | unit tests on pure functions (fixtures, edge cases) |
| Investing off: zero market-data calls, no UI | test with an outbound-HTTP spy + e2e nav check |
| Provider chain fallback, budgets, FX, staleness | mocked-provider tests |
| No buy/sell or predictive wording | test over `el.json` and `en.json` |
| Report exactly once, snapshot | integration test |
| Backups, retention, restore, alert, config validation | scripted tests against Compose (local restic repo) |
| PWA installable, offline queue syncs | Playwright (offline mode) |
| Design | PRODUCT.md, DESIGN.md, screenshots 375/1440 light/dark reviewed, axe-core no serious/critical |
| CI, image, release, deploy | actionlint, local runs of every CI command, `gh run` status, deploy/rollback test log |

End of every phase: lint, typecheck, unit + integration tests, production build, `docker compose build && up`,
screenshots for changed UI, `docs/PROGRESS.md` update, staged-diff secret scan (gitleaks), commit, push.

## 14. Design direction

The brief pins the direction: calm, trustworthy, clean-but-data-rich fintech; mobile-first with a thumb-reachable
quick-add; tabular numerals for money; accessible chart palette; dark mode; fonts with the Greek subset; WCAG AA.
Phase 1 turns this into PRODUCT.md, tokens, components and DESIGN.md with Impeccable.

- **Use scene.** Evening logging on a phone after the 21:00 reminder, often in low light; a month-start review on
  the 1st at 09:00; occasional desktop sessions for planning, tax and reports. Private and unhurried.
- **Mode.** Every screen is an "Operate" surface: precision and restraint, familiar controls, brand in the details.
- **Theme.** Light and dark are both first-class; the system preference decides, with a manual override.
- **World (Impeccable roll, D-022).** Athens Metro wayfinding: the month is a metro line and every dated item is a
  station on its day, hollow while expected, filled once received or paid. Contract:
  `.impeccable/surfaces/src-app-app-layout-tsx.md`.
- **Colour (OKLCH tokens).** A navy rail owns the shell (desktop sidebar, phone bottom bar); cool tile-grey ground with
  white panels in light mode, deep navy ground in dark mode. One action blue for primary actions, selection and
  focus. Line colours do data work: income green, spending red, goals ochre, tax reserve violet; warning amber and
  danger red always come with an icon and text. Expected versus done is hollow versus filled plus a text label, never
  colour alone. Chart palette: 8 categorical hues tuned per theme, at least 3:1 against the surface, always labelled.
- **Type.** Source Sans 3 (variable, Greek subset, self-hosted from `@fontsource-variable`), one family for
  everything; hierarchy from size and weight only; tabular figures verified by a test (D-032). Fixed rem scale with a ~1.2 ratio.
  Money uses tabular numerals, a true minus sign, right alignment in tables and a lighter currency symbol.
- **Layout.** Mobile: bottom bar with four destinations and a central Add button. Desktop: left sidebar.
  Content width about 72 rem. The dashboard is a sequence of sections with hairline dividers, not a grid of
  identical cards; no nested cards, no eyebrow labels, no gradient text, no decorative glass, icons from one
  library at one stroke width.
- **Quick-add.** Bottom sheet; amount field focused with the decimal keypad; recent categories as chips; date
  defaults to today; one tap to save; works offline. Target under 5 seconds.
- **Data display.** Ledger-style rows (date, label, category, amount), clear expected/paid states, skeletons for
  loading, empty states that teach the next action.
- **Motion.** 150–250 ms for state changes only (sheet, toast, progress); `prefers-reduced-motion` respected.
- **Browser surfaces.** Focus ring, text selection, caret, scrollbars and numerals are themed from the palette.
- **Accessibility.** WCAG 2.2 AA contrast, 44 px touch targets, full keyboard paths, charts with `role="img"`,
  a text summary and a hidden data table, `lang` set per locale, errors linked to their fields.
- **Greek.** Greek strings run longer: both locales are screenshot at 375 px; labels wrap instead of truncating;
  `hyphens: auto` under `lang="el"`; money values never truncate.
- **Print.** Reports print on A4 in light colours without navigation.

## 15. Design tools: SKILL.md review notes

| Tool | Reviewed | Finding | Outcome |
|------|----------|---------|---------|
| Impeccable (`pbakaus/impeccable`, SKILL.md v4.7.0, CLI `cli-v4.7.0`; user's global install, launcher 0.1.16 with a bundled darwin-arm64 binary, so nothing was downloaded) | Full SKILL.md, README, `scripts/impeccable` launcher, `init`, `craft-floor`, `operate` references | Design guidance plus a launcher that downloads an engine binary on first run, a `concept-seed` step that calls the impeccable.style API (README: no project data sent), telemetry on by default, optional image generation and a localhost live mode | Brief rule would block a project install. The user said on 2026-10-22 that the skills are installed globally, so the user's global install is used with telemetry off (`DO_NOT_TRACK=1`, `IMPECCABLE_NO_TELEMETRY=1`, `.impeccable/config.json`) and `IMPECCABLE_HOME` inside the project. Commands: `init` (PRODUCT.md), `shape` before each major screen, `critique`, `audit`, `adapt`, `harden`, `onboard`, `typeset`/`layout`/`colorize` as needed, `polish` before each phase commit, `document` (DESIGN.md). Questions are answered from the brief, never waited on. |
| vercel-labs/agent-skills @ `063bee94` — `react-best-practices` | Full SKILL.md | 70 React/Next.js performance rules, guidance only, no scripts, no network | Copied to `.claude/skills/` (project scope) in Phase 1 |
| vercel-labs/agent-skills — `web-design-guidelines` | Full SKILL.md | Instructs fetching fresh rules from a raw GitHub URL before every review | Not installed (brief rule). Its rules document is read once, pinned, as reference |
| vercel-labs/agent-skills — others | README | `composition-patterns` not requested; `vercel-deploy-claimable` uploads the project to a third party | Not installed |
| Playwright | MCP server already available; `@playwright/test` 1.64.1 from npm | Browser binaries are downloaded once at install (no user data) | Test runner for e2e, screenshots (375/1440, light/dark) and axe-core checks; MCP for ad-hoc inspection |

Other design skills present at user scope are not used (project rule).

## 16. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Small shared host (memory, disk) | Compose memory limits, Mongo cache 0.25 GB, keep last 3 images, never prune other projects' images |
| `tailscale serve` on 443 next to an existing public proxy | Documented check after setup; fallback `--https=8443` |
| Free provider coverage unknown without keys | Mocked providers in tests, manual price entry, cached last price with staleness, pending live check logged |
| Tax rules change or are ambiguous | Versioned, editable per-year config with source links and review dates; `[uncertain]` flags in docs and UI; every figure labelled as an estimate |
| New major versions (Next 16, React 19.3, TS 6, ESLint 10, Vitest 5) | Exact pins, lockfile, full checks every phase; `next build --webpack` as fallback if a Turbopack issue blocks |
| Web Push limits (iOS Home Screen only, expiring subscriptions) | In-app banner for every notification, subscription clean-up on 404/410, iOS guidance in settings |
| Backups unverified on R2 without credentials | Local repository fully tested (backup, retention, restore, counts); R2 steps documented; pending item logged |
| Large scope in one hands-off run | Phase order kept, pure logic first with tests, blockers logged instead of stalling, `docs/PROGRESS.md` at every milestone |
| GitHub Actions free minutes | Path filters, caches, concurrency cancel-in-progress, job timeouts; budget estimate in §11 |
| Time-zone and DST bugs | All schedule math in one module with Europe/Athens tests on both DST days and month edges; fake-clock worker tests |
| Rotating generated secrets by mistake | `.env.example` warns; deploy scripts never touch `.env`; README explains which secrets must never change |
