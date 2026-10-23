# Decisions

Every decision made during the hands-off run, with its rationale. Newest phase last.
Format: ID, decision, rationale, alternatives considered. Versions were checked with `npm view` on the date shown.

## Phase 0 (2026-10-21 / 2026-10-22)

### D-001 Runtime: Node.js 24 LTS (24.22.1, "Krypton")
- **Why:** The brief asks for the current LTS. On 2026-10-21 the Node.js release schedule
  (`nodejs/Release` `schedule.json`) lists v24 as LTS (maintenance since 2026-10-20) and v26 as LTS only from
  2026-10-28. `https://nodejs.org/dist/index.json` shows v24.22.1 (2026-10-20, `lts: Krypton`) as the newest v24.
- **Follow-up:** Move to Node 26 after 2026-10-28 (Dependabot proposes the base image bump).
- **Local machine:** runs Node 25 (non-LTS). Local commands are fine with it; the image and CI pin 24.

### D-002 Framework: Next.js 16.4.2, React 19.3.1, App Router
- **Why:** Latest stable on npm (2026-10-21). Next 16 uses Turbopack for `next build` by default,
  renames `middleware` to `proxy` (Node.js runtime only) and removes `next lint`
  (source: nextjs.org/docs/app/guides/upgrading/version-16, read 2026-10-22).
- **Consequences:** `src/proxy.ts` for auth redirects, CSRF origin checks and the CSP nonce;
  ESLint runs through its own CLI with `eslint-config-next` flat config.

### D-003 TypeScript 6.0.3, not 7.0.2
- **Why:** `typescript-eslint@8.72.0` declares `typescript >=4.8.4 <6.1.0` as its peer range, so TS 7 would
  break type-aware linting. TS 6.0.3 satisfies Next 16 (minimum 5.1) and typescript-eslint. `strict: true`.

### D-004 Database access: official `mongodb` driver 7.7.0, no ODM
- **Why:** A thin repository layer makes per-user scoping explicit (every query takes `userId` first) and keeps
  validation in one place (zod). Mongoose 9.11.3 was considered; its schema layer duplicates zod and hides
  query shapes that the isolation tests need to see.

### D-005 Auth: small custom session layer on vetted primitives
- **What:** argon2id via `@node-rs/argon2` 2.2.2 (prebuilt binaries, no compiler needed), TOTP via `otpauth` 9.5.2,
  random 32-byte session tokens stored only as HMAC-SHA256 values (key `SESSION_SECRET`) in Mongo, `HttpOnly` + `Secure` + `SameSite=Lax`
  cookies (`__Host-` prefix over HTTPS), Mongo-backed login rate limiting, TOTP secrets encrypted with
  AES-256-GCM using `DATA_ENCRYPTION_KEY`.
- **Why:** The setup wizard, closed registration and owner-issued invites are custom flows in any library.
  Better Auth 1.7.12 was considered: it defaults to scrypt (argon2id needs custom hash hooks), and its plugins
  and schema add surface area that a single-owner app does not need. A small, fully tested module is easier to audit.
- **Recovery:** with no e-mail, an admin CLI inside the container can reset a password or disable TOTP.

### D-006 Reads in Server Components, writes through REST route handlers
- **Why:** One CSRF model for every mutation, one zod-validated API that both the UI and the offline expense queue
  use, and simple HTTP-level isolation tests. Server Actions are not used.

### D-007 CSRF defence in depth
- `SameSite=Lax` session cookie; `proxy.ts` rejects unsafe methods whose `Origin` does not match `APP_URL`;
  every unsafe request must also carry an `x-csrf-token` header equal to the `csrf` cookie (double submit).

### D-008 Charts: own server-rendered SVG components, no chart library
- **Why:** Donut, bar, line and progress bars are small to draw, render on the server with zero client JS,
  can carry `role="img"`, labels and a hidden data table for screen readers, and follow the design tokens exactly.
  Recharts 3.10.1 was considered (heavier client bundle, harder to make match the design).

### D-009 i18n: `next-intl` 4.14.9 without locale routing
- Locale comes from the user's setting (cookie before login). Greek default, English toggle. URLs stay the same.

### D-010 Dates: `date-fns` 4.4.0 + `@date-fns/tz` 1.5.0
- Instants are stored as UTC `Date`. Each dated item also stores its local calendar date (`YYYY-MM-DD` in the
  user's time zone) so grouping by day and month never shifts across DST or month boundaries.

### D-011 Styling: Tailwind CSS 4.3.3 with CSS-variable design tokens (light and dark)

### D-012 Fonts self-hosted from npm (`@fontsource`), never fetched from Google at run time
- The chosen family must include the Greek subset and tabular figures (checked in Phase 1).

### D-013 Hand-written service worker, no Serwist/Workbox
- **Why:** Next 16 builds with Turbopack by default, and the needs are small: offline shell, static asset cache,
  offline expense queue (IndexedDB) and push handling. A ~200-line worker is easier to review.

### D-014 One image for app, worker and scripts
- The worker, the migration runner and the admin CLI are bundled with esbuild into the same image as the
  Next.js standalone server. Compose starts them with different commands.

### D-015 Separate backup image
- Based on the official `mongo` image (for `mongodump`/`mongorestore`/`mongosh`), plus a pinned, checksum-verified
  restic binary and a cron runner. Published next to the app image. Keeps restic and Mongo tools out of the app image.

### D-016 Design tools (brief: "Design" section)
- **Impeccable:** the user's global (user-scope) install is used, per the user's message of 2026-10-22
  ("the skills are installed in Claude globally"); no project-scope copy. Telemetry is turned off
  (`DO_NOT_TRACK=1`, `IMPECCABLE_NO_TELEMETRY=1`, `.impeccable/config.json`), `IMPECCABLE_HOME` points inside the
  project, and no financial data is given to it. Review findings: `docs/BLOCKERS.md` B-001.
- **vercel-labs/agent-skills:** `react-best-practices` is not among the user's global skills, so it is copied
  into `.claude/skills/` at project scope from commit `063bee94c3f4df8453406c830b0a7df0f2860278`
  (pure guidance, no scripts, no installer run). `web-design-guidelines` is not installed: it fetches its rules
  from the network at run time (B-002).
- **Playwright:** the Playwright MCP server is available, and `@playwright/test` is added for the e2e smoke job
  and for repeatable 375 px / 1440 px, light / dark screenshots.

### D-017 Mongo users
- Root user (initialised from `.env`) for init, backup and restore inside the Compose network only.
  The app and worker use a separate `readWrite` user on the finance database.

### D-018 Investing module: per-user flag, shared price cache
- The flag lives in each user's settings (wizard and settings page). Watchlists, manual prices and risk profiles are
  per user. Market prices and FX rates are public data and are cached once for all users. With no user enabled,
  the worker makes no market-data calls at all.

### D-019 Generated recurring entries are keyed by occurrence
- Unique index on (user, source kind, source id, occurrence date). Deleting a generated occurrence marks it
  `skipped`, so the generator never recreates it.

### D-020 Notification idempotency: insert-before-send
- A unique (user, key) entry in `notification_log` is written before a push is sent. A crash between insert and send
  loses at most one reminder and never duplicates one.

### D-021 Research subagents run on Sonnet with high effort
- **Why:** User request on 2026-10-22, after the first five research subagents were stopped at about 95 % usage
  without writing their deliverables. They are relaunched with model `sonnet`, effort `high`.

### D-023 Smart Plan rule (from `docs/allocation-methodology.md`)
- Variable-income baseline = the **minimum** of the last up to 6 complete months (not the median): MoneyHelper
  advises budgeting for the lowest month, and everything above the baseline is routed by the surplus rule, so being
  conservative costs little. Defaults 30 % discretionary, 10 % investing (gated until the emergency fund holds
  3 months of essentials), 5 % savings floor, irregular profile at ≥ 25 % irregular income, emergency fund 3 or
  6 months. The numbers without a source are listed as decisions in section 8 of the methodology and are overridable.

### D-024 Tax/EFKA estimator: reserve event model, rates only in per-year config
- `Reserve(t) = tax(E + B(t)) − tax(E)`; each invoice reserves its marginal delta, so month and year totals agree by
  construction. VAT and the income-tax delta move to the tax reserve at the invoice; EFKA at month end.
  Rates in `config/tax/<year>.json` with source ids, review dates and `uncertain` flags (`docs/research/tax-efka.md`).
- Conservative defaults where the rule is unclear: parallel-insurance offset defaults to 0, withholding is not netted
  at invoice time, minimum presumed income off by default (exempt in the first 3 years).

### D-025 Market data: per-instrument chain, 07:30 Athens refresh
- Chain and budgets as in `docs/MARKET-DATA.md` section 7 (80 % of each free limit). The refresh moves from "after the
  US close" to 07:30 Europe/Athens Tuesday–Saturday because Twelve Data documents EOD bars as available after
  00:00 ET the next day; retry at 12:30. FX from Frankfurter v2 with `providers=ECB` (v1 is deprecated).
- UCITS listings have no confirmed free provider: manual price entry is the guaranteed path (B-003).

### D-026 Backups: restic 0.19.1 in a mongo-based image, catch-up scheduler, in-container restore test
- As in `docs/research/backup-r2-restic.md` section 7. No `--gzip` on the dump (restic deduplicates and compresses).
  The restore test runs a temporary `mongod` inside the backup container, so it needs no Docker socket.
- New variables `BACKUP_HOST`, `BACKUP_REPO_PREFIX`, `SFTP_KNOWN_HOSTS_FILE`, `BACKUP_TIMEOUT_MINUTES`,
  `BACKUP_STALE_HOURS` are added to `.env.example` and `.env` in Phase 1.

### D-027 GitHub free-plan limits (verified 2026-10-22)
- 2,000 Linux minutes a month on a Free private repo, per-job rounding; 500 MB artifact/package storage; 10 GB cache
  per repo; GHCR storage and bandwidth currently free. No payment method on the account, so CI stops rather than
  bills. Source and dates: `docs/research/github-ci-limits.md` section 1.

### D-028 CI layout: merged jobs, pinned binaries for scanners
- Jobs `static`, `test`, `secrets`, `image` (+ e2e from Phase 2) and `ci-success`, about 18 min warm per push
  (≈ 70 % of the monthly allowance at the expected rate). The naive one-job-per-check layout (~31 min) would exceed it.
- gitleaks, Trivy and actionlint run as checksum-pinned binaries instead of third-party actions (fewer moving
  parts; Trivy actions were compromised in March 2026, advisory GHSA-69fq-xp46-6x23). Trivy ≥ 0.72 (0.76.1 pinned).
- Provenance: BuildKit `provenance: mode=max` + `sbom: true` on pushed images; GitHub artifact attestations need
  Enterprise Cloud for private repos (B-007).

## Phase 1 (2026-10-22)

### D-022 Design direction: Athens Metro wayfinding (Impeccable, code-led)
- **Process:** `/impeccable init` wrote `PRODUCT.md` from the brief (hands-off: the interview was answered from the
  brief, every fact sourced to it). `impeccable concept-seed --scope direction --mode operate` ran once through the
  network (one GET to the impeccable.style roll API carrying scope, mode and a seed key only; no project data) and
  assigned candidate 4 of seven grounded directions. The decision page was not served because the brief forbids
  waiting for the owner; the roll was judged in-thread and every challenger got a verdict.
- **Grounded list (by resonance):** 1 Greek tax and EFKA forms (numbered field codes), 2 bank passbook,
  3 banknote security print, **4 Athens Metro wayfinding (assigned, built)**, 5 Aegean nautical chart,
  6 freelancer receipt pad, 7 KTEL/OSE timetable.
- **Direction:** the month is a metro line; each dated item is a station, hollow while expected, filled when
  received or paid. Navy shell rail, cool tile ground, line colours for data (green income, red spending,
  blue action, ochre goals, violet tax reserve), Commissioner variable, tabular figures, one-pixel rules.
- **Challengers (all declined, each donated one discipline):** boarding pass and gate board (changed state holds
  until acknowledged), dark-first console (destructive actions isolated), centre-rail reference setting
  (one-device-pixel rules, states as marks), variable-font specimen (hierarchy from one face's size and weight),
  zoo guide map (flat colour owning whole regions). Convention catalog: no transferable discipline beyond the above.
- **Recorded in:** `.impeccable/surfaces/src-app-app-layout-tsx.md` (direction contract, seed reference).
- **Why not the pick (tax forms):** the brief asks for calm and trustworthy; form-paper bureaucracy risks
  reading as the tax office on every screen. Its "show the working" discipline is kept through visible formulas.
- **Subagents:** Impeccable's finish reviewer and documenter subagents are not spawned (project rule: subagents only
  for Phase 0 research). Their degraded in-thread procedures are used instead.

### D-029 `use-intl` 4.14.9 as a direct dependency
- `use-intl/core` provides `createTranslator` without React, for push texts built in the worker and route handlers.
  It is already installed as `next-intl`'s own dependency; pinning it directly makes the import explicit.

### D-030 Dependencies added in Phase 1 (one line each)
- `@fontsource-variable/source-sans-3` 5.3.1: self-hosted variable UI font with Greek and tabular figures (D-032).
- `lucide-react` 1.61.0: one icon family, one stroke width.
- `qrcode` 1.5.4: TOTP enrolment QR code rendered on the server as a data URL.
- `server-only` 0.0.1: build-time guard that server modules never reach a client bundle.
- `@axe-core/playwright` 4.14.0: accessibility checks in the e2e and screenshot runs.

### D-031 Next.js telemetry disabled through the environment
- Next.js sends anonymous usage telemetry unless disabled, and it was enabled on the build machine. The brief allows
  no telemetry. Every npm script, the Dockerfile and CI set `NEXT_TELEMETRY_DISABLED=1` (plus `DO_NOT_TRACK=1`).
  The machine-wide setting (`next telemetry disable`) is not changed because it lives outside the project.
- The first local `next build`, `next typegen` and `next dev` runs of Phase 1 (2026-10-22) ran before this fix and
  may have sent anonymous Next.js usage events (no project code or data). Logged as B-008.
- `agentRules: false` stops `next dev` from writing an `AGENTS.md` into the repository.

### D-032 Font: Source Sans 3 instead of Commissioner
- **Why:** The brief requires tabular numerals for money. A browser measurement on 2026-10-22 showed Commissioner
  (fontsource build) has no `tnum` feature: ten 1s measured 171 px and ten 0s 261 px at 40 px with `tnum` on.
  Source Sans 3, Manrope, Noto Sans, Roboto Flex and Geologica all passed (equal widths) and all ship Greek.
- **Choice:** Source Sans 3: a proven UI workhorse, narrow enough for long Greek labels, with a Greek extension.
  The screenshot tour now asserts equal digit widths, so a font change cannot silently break it again.

### D-033 Docker image and Compose hardening
- App image: `node:24.22.1-trixie-slim` pinned by digest, multi-stage, Next.js standalone + esbuild bundles, runs as
  `node` (uid 1000), `HEALTHCHECK` on `/api/health`. Size (local arm64 build, 2026-10-22): **99 MB compressed,
  429 MB on disk**. CI prints the amd64 size on every run.
- Compose: MongoDB only on an `internal: true` network (no route out, no published port); app and worker also on an
  `edge` network for push/market/FX egress; app published on `127.0.0.1` only; one-shot `migrate` service gates app
  and worker; read-only root filesystems, `cap_drop: [ALL]`, `no-new-privileges`, memory limits.

### D-034 Backup implementation details (local verification 2026-10-22)
- Restore resolves `latest` to a snapshot ID before its safety backup (otherwise it would restore the safety
  snapshot) and keeps `backup_runs` untouched (`--nsExclude`), so the run history survives a restore.
- The restore test's scratch `mongod` lowers `indexBuildMinAvailableDiskSpaceMB` to 32 because it runs on the
  container's 512 MB tmpfs (MongoDB refuses index builds below 500 MB free by default).
- restic 0.19 keeps the oldest snapshot while the history is shorter than the policy, so one day of backups settles at
  two snapshots; the retention check expects at most two.
- `gosu` is deleted from the backup image: it is only used by the mongo server entrypoint, and Trivy 0.76.1 reported a
  critical Go stdlib CVE (CVE-2025-68121, crypto/tls) in it. The `mongo` service itself keeps the official image;
  gosu there only drops privileges at start and does no TLS. Dependabot proposes the next mongo patch tag.

### D-035 CI specifics
- `ci.yml` runs on pull requests and pushes to `build/**`; `release.yml` runs on `main` and `v*` tags and calls
  `ci.yml` (`workflow_call`), so `main` is never tested twice. A `changes` job (plain `git diff`, no third-party
  action) skips heavy jobs for docs-only changes; `ci-success` aggregates. gitleaks 8.30.1, Trivy 0.76.1 and
  actionlint 1.7.12 run as SHA-256-pinned release binaries. The image job also smoke-tests the container as non-root.
- `npm audit --audit-level=critical` passes. It reports 5 **high** findings, all in the dev-only lint chain
  (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`); the suggested fix
  downgrades `eslint-config-next` to 14.x, which would break linting on Next 16. Left to Dependabot; not shipped in
  the image.

### D-036 MongoDB 7.0.45 instead of 8.0.34 (kernel incompatibility)
- **Found:** the first CI run failed because `mongo:8.0.34` exits at start-up on the GitHub runner: "MongoDB cannot
  start: Linux kernel versions 6.19 and newer has a known incompatibility with this version of MongoDB"
  (SERVER-121912, TCMalloc and the kernel's rseq ABI).
- **Source:** the compatibility matrix in https://jira.mongodb.org/browse/SERVER-125742 (read 2026-10-22): on kernels
  6.19–7.0.13 every 8.0.21+, 8.3 and 9.0 build exits during start-up and 8.0.0–8.0.20 may crash with possible
  corruption; **MongoDB 7.0 (all versions) is fully supported on every kernel range**. Kernel 7.0.14+ is fine again for
  8.0.35+ / 9.0, but SERVER-136848 (open) reports that the start-up check still blocks Ubuntu's 7.0.14-based kernels.
- **Decision:** run MongoDB **7.0.45** (`mongo:7.0.45-jammy`, pinned by digest) in Compose, the backup image and CI.
  The server runs Ubuntu 24.04; a routine kernel update into the affected range would otherwise stop the database.
  The app uses nothing that needs 8.0. Local checks re-run on 7.0: 78 tests, full stack healthy, all backup checks PASS,
  Trivy CRITICAL gate clean.
- **Lifecycle:** MongoDB 7.0 is supported until 2027-08-31 (https://www.mongodb.com/legal/support-policy/lifecycles,
  read via search 2026-10-22). Upgrade path in `docs/BLOCKERS.md` B-010.

## Phase 2 (2026-10-22)

### D-037 Recurring generation window and edits
- Expected occurrences are generated from the month a source was created (never older history) to the end of next
  month, keyed `income|expense:<sourceId>:<localDate>` with a unique partial index and `$setOnInsert` upserts, by the
  hourly worker job and on every page that shows the month. Editing, pausing or cancelling a source deletes only its
  future expected generated rows and regenerates them; confirmed and skipped rows are never touched. Deleting a
  generated row marks it `skipped`, so it is never generated again. The calendar projects later months on the fly
  without writing rows.

### D-038 Categories seeded per user at account creation
- Greek or English names by the user's locale at creation, with a `seedKey` (`expense:home/rent`), colours from the
  8-colour chart palette and an `essential` flag for the Smart Plan. Seeding is idempotent by `seedKey`; a user's own
  category with the same name wins. Used categories are archived instead of deleted.

### D-039 Transfers and balances
- A transfer is one transaction (`kind: transfer`, `accountId` → `toAccountId`), so it never counts as income or
  spending. Balance = opening balance + done income − done expenses − transfers out + transfers in.

### D-040 Quick-add and the offline queue
- Every quick-add carries a client UUID; the server keeps `{userId, clientId}` unique and returns the first row on a
  repeat, so a replay or a double tap never duplicates. When the API cannot be reached, the expense goes to IndexedDB
  (`finance-offline/queue`, shared with the service worker) with the CSRF token; it is replayed by Background Sync where
  supported and always by the page on start and on `online`. The offline page reads cached category and account names
  (no amounts) from the same database.

### D-041 CI e2e smoke inside the image job
- The smoke test runs against `docker compose` started from the images the job just built (no second build), with
  throwaway secrets generated in the job, so no repository secret is needed.

## Phase 3 (2026-10-22)

### D-042 Dashboard charts and ranges
- Pure aggregations in `src/lib/aggregates.ts` (only completed transactions count; subcategories roll up to their
  top-level category; donuts fold beyond 7 slices into "Other" without changing the total). Server-rendered SVG with a
  hidden data table (the tests read the exact numbers back from the markup).
- Range filter: this month, 3, 6, 12 months, year to date. Donuts follow the range; the monthly bars and the net-worth
  line show at least six months; net worth starts at the month of the first account (nothing to measure before it).

### D-043 Budgets on top-level categories plus one overall budget
- Budgets are set per top-level expense category (subcategory spending rolls up) and overall; a zero amount removes a
  budget. Progress uses month-to-date completed spending and the user's thresholds (80 % and 100 % by default), which the
  Phase 4 overspend alerts reuse.

## Phase 4 (2026-10-22)

### D-044 Notification timing, catch-up and de-duplication
- Each job runs every worker tick (30 s) per user in the user's time zone and sends through the insert-before-send log
  (D-020), so repeated ticks, restarts and two workers cannot duplicate a message.
- Daily reminder: from the configured time (default 21:00) for 2 hours, key `daily:<localDate>`.
- 1st-of-month flow: on the 1st from the configured time (default 09:00) for 14 hours, key `monthly:<YYYY-MM>`; it opens
  `/monthly` (last month at a glance, this month's expected income to confirm, record irregular pay, report link, and
  the investing suggestion link when that module is on).
- Renewals: from 09:00 local on the day N days before the renewal (per subscription, default from settings) until the
  renewal day, key `renewal:<subscriptionId>:<renewalDate>`; paused or cancelled subscriptions stay quiet.
- Overspend: when month-to-date spending crosses a threshold of a budget, key
  `overspend:<categoryId|overall>:<YYYY-MM>:<threshold>`; if several thresholds are crossed at once only the highest is
  sent and the lower ones are logged as `superseded`, so they never arrive late.
- Every notification is also stored in-app; the shell shows unread ones from the last 14 days as a banner (the
  fallback when push is off, unsupported, or iOS outside the Home Screen).

### D-045 CI: Playwright browser cached, no apt step
- One Phase 3 run spent 721 s in `playwright install --with-deps` (apt on the runner), turning a 4-minute job into 16.
  The image job now caches the browser folder keyed by the Playwright version and installs only the headless shell
  without `--with-deps`; the `ubuntu-24.04` image already ships Chrome and its system libraries.

## Phase 5 (2026-10-22)

### D-046 Goal contributions are earmarks, not account transfers
- A contribution records money set aside for a goal (`goal_contributions`: amount, local date, source `manual` or
  `plan`). It does not move money between accounts and does not change balances, net worth or spending; a goal's
  optional linked account is a label for where the money sits. This keeps one source of truth for balances and lets a
  goal live inside an ordinary savings account.
- Deleting a contribution is allowed (typo fix); archiving a goal keeps its contributions.

### D-047 Goal progress, required amount and pace
- Progress = saved / target (capped at 100 % for display). Required monthly = remaining / months from this month to
  the deadline month (at least 1), rounded up to the cent, so paying it each month reaches the target on time.
- Pace = contributions of the current and the two previous calendar months / 3. Projected completion = this month plus
  remaining / pace months; with no pace the UI says "no recent contributions" instead of a date.

### D-048 Smart Plan: applying is idempotent and never feeds back into its own month
- "Record on the goals" upserts one `plan` contribution per goal per month (`planMonth`); running it again replaces the
  amounts, and a zero amount removes the row. The plan for a month subtracts that month's own plan contributions
  before computing, so applying twice gives the same numbers.
- The plan uses complete months only (methodology 3.1); the current month affects only the surplus block.
- The surplus tax-reserve step reads 0 until the Phase 7 estimator supplies the amount due.

### D-049 The working is rendered from message templates, not a `Plan.steps` array
- Methodology section 6 sketches a `steps` array. The view instead renders each block's formula from the message
  catalogue (Greek and English) and its inputs from the plan result, which already carries every number. A unit test
  renders the view for every worked example and checks the disclaimer, each formula and the inputs (the section 6 test
  contract), plus a wording check that nothing outside the disclaimer says buy, sell, predict or names an instrument.

### D-050 Goals on the calendar
- Recorded contributions show on their dates (filled ochre station). A goal with a deadline also shows its required
  monthly amount at the end of each month after the current one up to the deadline month (on the deadline day in that
  month), matching D-047's spread; in the deadline month itself, when it is the current month, the amount still due
  shows as expected. Reached goals show nothing due.

### D-051 Split colours
- Essentials use Line Red (money that must be spent), savings Line Ochre (goals), discretionary the neutral slate and
  investing the teal chart colour, because no line colour exists for investing until Phase 6. Colour is never the only
  carrier: the table beside the bar names each part with its amount and share.

## Phase 6 (Investing module)

### D-052 Market prices as integer micro-units
- Shared `prices` and per-user `manual_prices` store the close as an integer number of millionths of the trading
  currency (`closeMicros`, `priceMicros`), never a float, following the money rule. Six decimals cover quotes such as
  GBX and sub-cent prices; the bound (10^15) stays inside `Number.MAX_SAFE_INTEGER`. Metrics convert to numbers only
  for ratios. EUR display values are integer cents (`toEurMinor`), rounded once.
- FX rates stay decimal numbers: they are ratios published by the ECB, not money.

### D-053 Starter watchlist on the first visit
- The 10-row educational list from `docs/MARKET-DATA.md` 6.1 is added the first time a user with the module on opens
  any investing page or the watchlist API, and `settings.investing.seeded` is set, so deleted rows never return. Every
  investing page calls `requireInvestingUser()` itself because Next.js renders a layout and its page concurrently.
- AGGH (bonds) is not flagged `core`, so the core share goes to broad equity ETFs only.

### D-054 Risk questionnaire
- Three questions (horizon, reaction to a 20 % fall, experience), each answer 0–2 points by position: 0–2
  conservative, 3–4 balanced, 5–6 growth. A horizon under 3 years is always conservative. Until answered the
  conservative profile applies, labelled "default". The user can override the profile. Profiles map to PLAN 6.6:
  top 3 / 5 / 7 instruments with at least 80 / 60 / 40 % core. Design choice without a numeric source; educational.

### D-055 Refresh slots, attempts and per-minute caps
- Two slots a day in Europe/Athens, 07:30 and 12:30 (MARKET-DATA 5.4). The worker evaluates every tick; each stale
  listing is attempted at most once per slot (`price_meta.lastAttemptSlot`), so restarts never repeat calls and a
  worker that was down catches up on its first tick. Fresh listings cost nothing.
- Expected close = the last trading day before today in the exchange's own time zone (NYSE 2026–2027 holidays,
  Euronext 2026; Xetra, LSE, Milan and SIX use weekdays only, [uncertain]).
- At 07:30 an older bar than expected is kept ("not yet published"); at 12:30 the chain moves on to the next provider.
- A full per-minute cap defers the listing to the next tick instead of spending a smaller budget further down the
  chain. A full daily budget, a quota/key error (blocks the provider until the next UTC midnight), a missing listing
  (cached 30 days) or an error (cached 1 hour) falls through to the next provider; after the chain, manual prices.
- Calls are reserved before they are made with a conditional upsert on `provider_usage`, so a counter can never pass
  its budget, also with racing workers (tested).

### D-056 Provider response mapping
- 401, 402 and 429 → stop the provider for the day; 403 and 404 → not covered for that listing; other codes → error.
  Twelve Data errors inside a 200 body follow their `code`; its "No data is available" answer is an empty success.
  FMP 402 means a premium endpoint or symbol → not covered. Alpha Vantage 200 without a series and with `Information`
  or `Note` → blocked; `Error Message` → not covered. Finnhub `/quote` with `c = 0` → not covered.
- Each request carries only the provider symbol, dates and the key (header where the provider accepts one).

### D-057 Ranking and split details
- Percentile within the watchlist with ties sharing the mid rank; a single instrument gets 100. Scores are rounded
  to 6 decimals so ties are exact. "Insufficient data" = less than half of the active weight available.
- Split weights are the scores with a floor of 1, so every selected instrument gets a share. The core target is
  rounded up ("at least"). Amounts refused by caps on one side are offered to the other side, then shown as "not
  placed (limits reached)". Each line names the cap it reached. Tested on fixtures and a 5 000-case property test.

### D-058 Investing colour and screens
- Investing keeps the teal chart colour from D-051 (no line colour exists for it). Core holdings carry a teal dot
  with the word "Core"; the split bar uses full teal for core lines and a lighter teal for the others, and the table
  beside it carries every number. Four views under one sub-navigation: ranking (with data status), monthly
  suggestion, watchlist, profile and limits.

### D-059 No new dependencies
- Phase 6 uses the platform `fetch` with `AbortSignal.timeout` (15 s) and the existing stack; nothing was added.

## Phase 7 (Month-end report + tax/EFKA estimator)

### D-060 Rates live only in config files and the user's copy
- `config/tax/2025.json` and `2026.json` are the section 9 blocks of `docs/research/tax-efka.md`, copied verbatim
  (sources, last-reviewed date, `uncertain` flags). They are bundled at build time; `tax_configs` holds each user's
  copy, seeded on first use. The editable subset is the scale, EFKA class amounts, the unemployment contribution, VAT
  rate and small-business limit, prepayment rate and reduction, and withholding rate and threshold; sources and flags
  stay as reviewed. "Restore the reviewed rates" deletes the copy. A tax year without a reviewed file uses the latest
  earlier year and says so [uncertain].

### D-061 What counts as an invoice
- Received (`done`) income from sources flagged `freelance` in the tax year; the amount is the invoice net of VAT,
  dated at receipt (cash recognition, research 7.9 [uncertain]). Business expenses are not modelled per invoice (0).
- The reserve event model, VAT crossing rule, EFKA floors with parallel employment, special-class expiry after five
  insurance years, prepayment (proportional method, halved the first time) and 20 % withholding follow research
  section 7 exactly; the worked example of section 8 is a unit test to the cent, and an integration test rebuilds it
  from stored transactions.
- Optional children and age rates (2026), the first-band cut and the minimum presumed income are opt-in and tagged
  [uncertain]; the minimum applies to the year view only.

### D-062 Set-aside moves
- "Move to reserve" creates a transfer (origin `tax_set_aside`) from the invoice's account, else the first checking
  account, into the tax reserve account (created on first use). VAT + income tax move per invoice; EFKA moves per
  month once the month has ended. The client id `tax:invoice:<id>` / `tax:efka:<YYYY-MM>` makes each move happen once.
- "To move now" = the year-to-date estimate (EFKA only for ended months, income tax including EFKA's release) minus
  what moved this year, never below zero, so it never exceeds the year-to-date total shown beside it. The Smart Plan
  surplus reserves this amount first (methodology 3.6).

### D-063 Month-end report
- Built by a pure function from the closed month and stored whole (`schemaVersion` 1); no update endpoint. The worker
  job generates last month's report as soon as the month closes in the user's time zone (before the 1st-of-month
  push); the history page fills in up to 24 missing closed months since the account was created. Unique
  `{userId, month}` makes concurrent attempts a no-op (tested with racing ticks).
- Contents: income, expenses, net, savings rate, change against the month before, top five categories, budget
  adherence, goal progress (saved at month end and added that month), next month's fixed costs and renewals, and the
  tax reserve against the estimated set-aside to month end (only with freelance income).
- Print: an A4 page rule, light tokens whatever the theme, and the rail, bottom bar, banner and buttons hidden.

### D-064 Horizontal overflow guard
- The screenshot tour now fails when any screen is wider than its viewport. It found absolutely positioned
  `sr-only` header cells escaping an unpositioned scroll wrapper on the tax tables; scroll wrappers are `relative`.

## Phase 8 (Release, deploy, hardening, handoff)

### D-065 Deploy scripts
- `deploy/lib.sh` holds the shared steps; settings come from the caller's environment, then `.env` read key by key
  (never sourced whole). State lives in `.deploy/` (gitignored): `current`, `previous`, `history`, `attempts`,
  `deploy.log`.
- The first deploy skips the pre-deploy backup because no backup service runs yet; every later deploy stops if the
  backup fails. MongoDB is started with `up --wait` before the migrations run as a one-off container.
- Rollback (automatic or `rollback.sh`) does not run migrations: they are forward-only and additive, so the
  previous release runs on the newer schema.
- Pruning keeps the images of the last 3 tags the script deployed or attempted (plus current and previous) and
  removes older ones it pulled. A first version ranked every local tag by creation time and, in the local test,
  removed newer images that had not been deployed yet; the attempt list fixes that and leaves images the script
  never handled alone. Only this project's two repositories are touched.
- `deploy/dc.sh` runs Compose on the recorded tag, so manual commands on the server never build `local`.
- The optional updater reads the OCI `revision` label of the moving `main` image (set by `docker/metadata-action`)
  and deploys the matching `sha-` tag; the timer ships disabled.
- Tested locally by `npm run test:deploy` (17 checks) in a throwaway Compose project on port 3310.

### D-066 Runbook sources
- Tailscale: HTTPS needs MagicDNS and "Enable HTTPS" on the DNS page, with the Certificate Transparency
  acknowledgement (tailscale.com/kb/1153/enabling-https, read 2026-10-23). The serve page lists `--bg`,
  `--https=<port>`, `status`, `off` and `reset` (tailscale.com/kb/1242/tailscale-serve, read 2026-10-23); the exact
  command in the README is composed from those flags and is [uncertain] until run on the server.
- R2, restic, Storage Box and Hetzner backup steps come from `docs/research/backup-r2-restic.md`; the GHCR pull token
  (classic PAT, `read:packages`) from `docs/research/github-ci-limits.md`.

### D-067 CI kept as built
- The CI and Release workflows from Phase 1 already meet the brief (parallel jobs, caches, per-branch
  cancel-in-progress, `ci-success`, SHA-pinned actions, `packages: write` only on `publish`). Phase runs took
  4.5–6 minutes. The one tuning lesson (a docs-only push cancelled a code run, B-011) is handled by process, not by
  weakening cancel-in-progress, which the brief requires.

### D-068 Donut shares in the reader's locale
- The donut legend printed "79.5%" in Greek. Shares now use the locale's decimal separator with a space before the
  percent sign ("79,5 %"), matching the rest of the app; the chart test checks the format.
