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
