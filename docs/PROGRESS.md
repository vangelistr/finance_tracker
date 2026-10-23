# Progress

Last updated: 2026-10-23
Status: **All phases (0–8) done.** Handoff: `docs/HANDOFF.md` (Greek).
Branch: `build/finance-tracker` (local, created from `main` at `64a012a`).
Last verified commit: `b655cd5` "Phase 7: month-end report + tax/EFKA" (CI run 39972067875 green, all jobs);
Phase 6 `b7bd263` (CI run 39967390812 green, all jobs incl. image); Phase 5 `b56be99`
(static + test green on GitHub, image job cancelled by concurrency, B-011); Phase 4 `de04e98`
(CI green); Phase 3 `172658f`; Phase 2 (`71ca02c`) CI green
including the e2e smoke job. CI on GitHub was green for Phase 1 at `c0aed5b`
(after two fixes: `public/` on a clean checkout, and MongoDB 7.0.45 because 8.0 exits on Linux 6.19+, D-036).

## Phases

| Phase | Status | Commit |
|-------|--------|--------|
| 0 Research and plan | done | `6f22361` |
| 1 Foundation | done | "Phase 1: foundation" (see `git log`) |
| 2 Core | done | "Phase 2: core" (see `git log`) |
| 3 Dashboard, charts, budgets | done | "Phase 3: dashboard, charts, budgets" (see `git log`) |
| 4 Notification worker | done | "Phase 4: notification worker" (see `git log`) |
| 5 Savings goals + Smart Plan | done | "Phase 5: savings goals + Smart Plan" (see `git log`) |
| 6 Investing module | done | `b7bd263` |
| 7 Month-end report + tax/EFKA | done | `b655cd5` |
| 8 Release, deploy, hardening, handoff | done | "Phase 8: release, deploy, hardening, handoff" (see `git log`) |

## Phase 0 summary

- Research deliverables (five background subagents, Sonnet, high effort): `docs/research/tax-efka.md`,
  `docs/MARKET-DATA.md`, `docs/allocation-methodology.md`, `docs/research/backup-r2-restic.md`,
  `docs/research/github-ci-limits.md`.
- `docs/PLAN.md` complete (all sections, self-reviewed), `docs/DECISIONS.md` D-001…D-028 (Phase 0),
  `docs/BLOCKERS.md` B-001…B-007. `docs/SERVER-NOTES.md` and `docs/PROMPT.md` stay local (gitignored).

## Phase 1 summary (Foundation)

Verified on 2026-10-22 (local machine, arm64):
- `npm run lint` clean; `npm run typecheck` clean; `npx vitest run`: 53 tests passing (unit: money, dates;
  integration on a real Mongo: setup race and closed registration, CSRF, login rate limit, TOTP with replay block,
  invites, user A/B isolation, password change, logout, migrations idempotent, readiness, backup alerts with a fake
  clock).
- `npm run build` green; `npm run screenshots`: tour over a fresh DB with 24 captures (375/1440 px, light/dark),
  axe-core 0 violations, tabular figures asserted, PWA manifest + active service worker asserted.
- `docker compose down -v && docker compose up -d --build`: app, worker, mongo and backup **healthy**, migrate exited 0,
  mongo has no published port, app on `127.0.0.1:3000`, `/api/ready` ready, app and worker run as uid 1000.
  Image size 99 MB compressed / 429 MB on disk (D-033).
- `npm run test:backup` (scripts/test-backup.sh): retention, backup-now, restore with identical counts, restore-test,
  exit-78 config validation, failed run recorded — all PASS. R2 not verified (no credentials, B-004).
- actionlint 1.7.12 clean; `npm audit --audit-level=critical` passes (5 high in dev-only lint chain, D-035);
  Trivy 0.76.1 CRITICAL gate passes on both images (gosu removed from the backup image, D-034);
  `impeccable detect` 0 findings; design review record `docs/design-reviews/phase-1.md` (18/20).
- Design: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, direction contract in `.impeccable/surfaces/`.
  `react-best-practices` copied to `.claude/skills/` from vercel-labs/agent-skills @ `063bee94` (D-016).

Carried to Phase 2 by plan: onboarding steps for income sources, categories and accounts (they need the Phase 2
CRUD); the quick-add sheet and the central Add button; the remaining navigation destinations; the offline expense
queue (the service worker already replays a queue from IndexedDB).

Next: Phase 2 (Core) — income/expense/accounts/categories CRUD with Greek seed categories, recurring generation
(idempotent), subscriptions, calendar (month grid + mobile agenda as a vertical month line), quick-add + offline queue,
onboarding data steps, CI e2e smoke job (Playwright against `docker compose`).

## Phase 2 summary (Core)

Verified on 2026-10-22: `npx vitest run` 78 tests (adds recurrence, calendar month/DST edges, finance integration:
category seeding, CRUD and isolation for accounts, categories, sources, fixed costs, transactions, transfers and
balances, idempotent generation under repeated and concurrent runs, skip persistence, paused subscriptions, confirm,
client-id de-duplication, calendar projection and isolation); lint and typecheck clean; `npm run screenshots` (52
captures + quick-add, axe 0 violations, offline queue syncs once, PWA checks); `tests/e2e/smoke.spec.ts` passes against
`docker compose`; `impeccable detect` 0 findings. Design review: `docs/design-reviews/phase-2.md`.

Next: Phase 3 — budgets (per category and overall, monthly), dashboard charts as server-rendered SVG (donut expenses
by category and income by source, bars income vs expenses per month, line net worth, budget progress bars) with a
date-range filter and fixture tests that assert every chart's totals.

## Phase 3 summary (Dashboard, charts, budgets)

Verified on 2026-10-22: 91 tests (aggregates on a hand-computed fixture for every chart, chart markup totals, budgets
API and isolation); lint, typecheck clean; tour with budgets and charts (56 captures, axe 0); detector 0.
Design review: `docs/design-reviews/phase-3.md`.

Next: Phase 4 — worker jobs with a fake clock: daily reminder (default 21:00), monthly flow on the 1st (09:00; ensure
last month's report placeholder link, pre-filled income form listing expected recurring incomes, investing link when
enabled), renewal alerts N days before (per subscription), overspend alerts per category and overall at thresholds
(once per threshold per period), in-app notification banner, push per-type toggles (exist), iOS note (exists).

## Phase 4 summary (Notification worker)

Verified on 2026-10-22: 97 tests, including fake-clock worker tests: daily reminder at 21:00 Europe/Athens once a day
(also on the 25 Oct DST day), custom time and off switch; 1st-of-month flow once at 09:00; renewal alerts N days before,
once per renewal, paused subscriptions quiet; overspend once per threshold per budget per month, highest-only on a jump,
overall budget; in-app notifications API isolation. Tour 64 captures, axe 0. Design review `docs/design-reviews/phase-4.md`.

Next: Phase 5 — savings goals (target, deadline, linked account, priority, contributions manual or from the plan,
progress, required monthly, projected date) and the Smart Plan per `docs/allocation-methodology.md` §3 (pure functions,
property test, formula and inputs shown, overrides, disclaimer).

## Phase 5 summary (Savings goals + Smart Plan)

Verified on 2026-10-22: lint and typecheck clean; 134 tests (Smart Plan pure functions on the four worked examples of
`docs/allocation-methodology.md` §4, edge cases and a 200 000-case property test that the split always covers the
baseline exactly; goal progress, required monthly and pace; plan view contract test: disclaimer, formula and inputs for
every worked example, no buy/sell/predict wording outside the disclaimer; integration: goals CRUD and isolation, one
emergency fund, contributions, plan split, idempotent apply, overrides and reset, goal stations on the calendar).
`npm run build` green; tour 73 captures (adds goals and plan, applies the plan twice), axe 0; detector 0;
`docker compose build && up`: all services healthy, migration `0004-goals` applied, `/api/ready` ready.
Design review `docs/design-reviews/phase-5.md`. Decisions D-046…D-051. Also in this commit: CI Playwright browser cache
(D-045).

Next: Phase 6 — investing module behind the per-user flag (off by default): provider chain and budgets per
`docs/MARKET-DATA.md`, cache, FX (Frankfurter, ECB), watchlist with the starter list, Insights ranking (PLAN §6.6) with
educational labels, monthly suggestion fed by the plan's investing share, daily digest (off by default); mocks only
because no market-data keys exist (B-003); tests that the module makes zero network calls when off and that no
user-facing string says buy, sell or predicts.

## Phase 6 summary (Investing module)

Verified on 2026-10-23: lint and typecheck clean; **181 tests** (adds: metrics, ranking with ties and insufficient
data, split with caps, infeasible caps, top N, leverage/crypto and a 5 000-case property test that lines + unplaced
always equal the amount within every cap; exchange calendar and refresh slots across the DST change; adapter parsing
and error mapping for all five providers and Frankfurter; integration: **zero fetch calls and no counters while the
module is off, with provider keys set, through the real worker job list**; 404 on every investing route when off;
per-instrument routing, fallback on error / not covered / rate limit, daily budget never exceeded with three racing
refreshes, per-minute deferral, retry-slot fallback, ECB v2 with v1 fallback, EUR conversion, timestamps and staleness,
manual price as last resort, watchlist CRUD and isolation, 40-instrument cap, suggestion = Smart Plan investing amount,
data status never exposes keys, digest once a day after the refresh and only when enabled; i18n test: no buy, sell,
predict, signal or "best" wording in either language outside the two disclaimers).
`npm run build` green; tour 93 captures (adds 20 investing captures and the off-state 404 check), axe 0; detector 0;
`docker compose build && up`: all services healthy, migration `0005-investing` applied, `/api/ready` ready, worker
without errors. Market data: mocks only (no keys, B-003). Design review `docs/design-reviews/phase-6.md`.
Decisions D-052…D-059. No new dependencies.

## Phase 7 summary (Month-end report + tax/EFKA)

Verified on 2026-10-23: lint and typecheck clean; **204 tests** (adds: the research worked example to the cent, both
VAT cases and scenario A, bracket edges, the VAT crossing invoice, EFKA floors with a salaried job, extras and the
end of the special class, first-year prepayment halving and the minimum, withholding threshold, children and age
rates, year-to-date views; report builder; integration: report generated exactly once under racing worker ticks and
the history page, immutable after later edits, none for an open month, every section's figures, per-user API; tax
estimate from stored freelance income, set-aside per invoice and per ended month exactly once, the Smart Plan
surplus reserves the unmoved amount, editable rates change the estimate and reset restores them, invalid scale
rejected, isolation; views: every tax block labelled an estimate with the disclaimer and the [uncertain] list).
`npm run build` green; tour 106 captures plus a print capture, axe 0, horizontal overflow 0 (new guard); detector 0;
`docker compose build && up`: all services healthy, migration `0006-reports-tax` applied, `/api/ready` ready, worker
without errors. Reports and tax are in the navigation. Design review `docs/design-reviews/phase-7.md`.
Decisions D-060…D-064.

Next: Phase 8 — release workflow (reusable CI, GHCR publish with `packages: write` on the publish job only, tags
`sha-<short>`/`main`/`v*`, OCI labels), deploy scripts (`deploy/deploy.sh` with pre-deploy backup, pull, migrate,
up, `/api/ready` gate, automatic rollback, tag record, prune to 3; `rollback.sh`; `finance-updater.{service,timer}`
off by default) tested locally with Compose, CI tuning, hardening pass, final design polish, README runbook,
`docs/EXTRAS.md`, history secret scan, `docs/HANDOFF.md` in Greek and the final Greek summary.

## Phase 8 summary (Release, deploy, hardening, handoff)

Verified on 2026-10-23: lint and typecheck clean; 204 tests; `npm run build` green; tour 106 captures, axe 0,
overflow 0; detector 0 over `src/`; `npm audit --audit-level=critical`: 0 vulnerabilities; Trivy 0.76.1 CRITICAL gate
passes on the app and backup images; actionlint 1.7.12 clean; shellcheck 0.10.0 clean on `deploy/` and
`scripts/test-deploy.sh`; gitleaks over the full history (12 commits before this one): no leaks;
`docs/SERVER-NOTES.md`, `docs/PROMPT.md`, `.env` and `.deploy/` are not tracked.
`npm run test:deploy`: 17/17 (first deploy, pre-deploy backup recorded in `backup_runs`, prune to the last 3 app and
backup images, automatic rollback when the readiness gate fails, `rollback.sh`, idempotent migrations).
`docker compose build && up`: all services healthy, `/api/ready` ready, app image 437 MB on disk.
New: `deploy/` (deploy, rollback, update check, Compose wrapper, systemd units), `README.md` runbook,
`docs/EXTRAS.md`, `docs/HANDOFF.md` (Greek). Decisions D-065…D-068; blockers B-012.

Not verifiable by the build (see `docs/BLOCKERS.md`): the first Release run and GHCR packages after you merge to
`main` (B-009), server deploy and Tailscale serve (B-012), R2 (B-004), live market data (B-003), tax rules marked
[uncertain] (B-005), branch protection (B-006).

## Open issues

- `npm install` ran on local Node 25 (vitest EBADENGINE warning only); image and CI use Node 24.22.1.
- Impeccable concept-seed needed one network call to impeccable.style (scope, mode, seed key only), run with the
  sandbox disabled; logged in D-022.
