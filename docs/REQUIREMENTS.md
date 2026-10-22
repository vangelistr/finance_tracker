# Requirements (organized view)

The full brief is `docs/PROMPT.md` (local only). This file indexes it, maps it to phases and
records how ambiguous points are read. If they disagree, the brief wins.

## Product in one paragraph

A private, self-hosted personal finance PWA. Next.js (App Router) + React + TypeScript (strict)
+ MongoDB, all in Docker, reachable only through Tailscale (`tailscale serve`, HTTPS, no Funnel).
It tracks income and expenses, shows charts, sends Web Push reminders and alerts, and suggests a
monthly money split. An optional investing module (off by default) adds free market data and a
transparent instrument ranking. Greek UI by default with an English toggle, EUR, Europe/Athens.
The UI must look polished, not like a generic template.

## Requirement index

| # | Area | Key points | Phase |
|---|------|-----------|-------|
| 1 | Income | Sources (3 types), entries expected/received, auto-generated expected entries | 2 |
| 2 | Expenses | Categories + subcategories (Greek seeds), fixed recurring, one-off, quick-add < 5 s, subscriptions | 2 |
| 3 | Accounts and budgets | 6 account types incl. tax reserve, transfers, per-category + overall monthly budget | 2, 3 |
| 4 | Recurring calendar | Month view, colour-coded, expected vs done, day tap, mobile agenda, DST-correct | 2 |
| 5 | Charts | Donut (expenses, income), bar (income vs expenses), line (net worth), budget bars, date filter | 3 |
| 6 | Notifications | Web Push VAPID, daily 21:00, monthly 1st 09:00, renewals, overspend 80/100 %, market digest; worker, idempotent, fake clock | 4 |
| 7 | Savings goals | Progress, required monthly amount, projected date, priority distribution | 5 |
| 8 | Smart Plan | Conservative baseline for irregular income, 4-way split, overrides, formula shown, disclaimer, methodology doc | 5 |
| 9 | Month-end report | Once per month, immutable snapshot, history, print-friendly | 7 |
| 10 | Tax/EFKA estimator | Official sources only, versioned per-year config, per invoice/month/year, stacks other income, labelled estimate | 7 |
| 11 | Investing (optional) | Off by default; global watchlist, provider chain + cache + budgets, EOD refresh, ranking, monthly split, guardrails, wording | 6 |
| 12 | Auth | Setup wizard, closed registration + invites, argon2id, secure cookies, CSRF, rate limit, optional TOTP, onboarding | 1 |
| 13 | PWA | Manifest, icons, offline shell, offline add-expense queue, installable | 1 (shell), 2 (queue) |
| 14 | Backups | restic to private R2 (S3 API), local-dir default, retention, restore script + test, failure alert, config validation | 1 |
| 15 | Design | Impeccable-led, mobile-first, tabular numerals, dark mode, Greek font subset, WCAG AA | all |
| 16 | Extras | Ranked shortlist only, do not build | 8 |
| — | Infrastructure | app / worker / mongo / backup; app on 127.0.0.1 only; mongo no published port | 1 |
| — | CI/CD | CI with `ci-success`, release to GHCR, pull-based deploy + rollback, Dependabot, free tier only | 1, 2, 8 |

## Phase map

| Phase | Content | Main deliverables |
|-------|---------|-------------------|
| 0 | Research and plan, no app code | `docs/SERVER-NOTES.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/MARKET-DATA.md`, `docs/allocation-methodology.md`, tax research notes |
| 1 | Foundation | Scaffold, Dockerfile, health endpoints, Compose, CI + Dependabot, backup service, auth + wizard, PWA shell, i18n, tests, design skills, `PRODUCT.md`, `DESIGN.md` |
| 2 | Core | Income/expense/accounts/categories CRUD, recurring generation, subscriptions, calendar, CI e2e smoke job |
| 3 | Dashboard | Charts and budgets |
| 4 | Notification worker | Daily, monthly, renewal and overspend alerts |
| 5 | Goals and Smart Plan | Savings goals, allocation engine |
| 6 | Investing module | Feature flag, adapter + chain, watchlist, insights, monthly suggestion, digest |
| 7 | Report and tax | Month-end report, tax/EFKA estimator |
| 8 | Release and handoff | Release workflow, deploy scripts + rollback test, hardening, polish, README, `docs/EXTRAS.md`, `docs/HANDOFF.md` |

End of every phase: lint, typecheck, tests, production build, `docker compose build && up`,
Playwright screenshots (375 px and 1440 px, light and dark) for changed UI, `polish`,
update `docs/PROGRESS.md`, secret scan, commit, push.

The acceptance criteria in the brief are the definition of done. A phase is done only when its
criteria are verified by real command output.

## Interpretations

How ambiguous points in the brief are read. Change them here if the user corrects one.

1. **Income kinds vs types.** The brief lists 4 income kinds but 3 source types.
   Full-time salary and part-time fixed salary map to `recurring_fixed`.
   Per-job pay (εργόσημο) maps to `recurring_variable`. Invoices and deals map to `one_time`.
2. **Progress file location.** The brief uses `docs/PROGRESS.md`. The usage-limit rule writes
   to the same file. There is no root `PROGRESS.md`.
3. **The brief stays local.** `docs/PROMPT.md` is gitignored because it contains a local file
   path and a domain name, and the brief forbids server details in committed files.
   Committed docs refer to "the public CDN bucket" without naming its domain.
4. **Pre-start files.** `CLAUDE.md`, `.gitignore` and the docs created before the start are
   committed on `build/finance-tracker` as part of the Phase 0 commit, never on `main`.
5. **Impeccable is already present at user scope.** The brief asks for a project-scope install after a
   SKILL.md review. The user overrode this on 2026-10-22: the global install is used with telemetry off
   (`docs/BLOCKERS.md` B-001, `docs/DECISIONS.md` D-016).
6. **Playwright MCP is already available.** It counts as the third design tool.
   The Playwright test runner is still added as a dev dependency for the e2e smoke job.
7. **Missing local tools** (gitleaks, Trivy, actionlint, restic, pandoc). Run them through
   pinned Docker images, or inside the project's own containers. Do not install them globally,
   because the brief forbids changes outside the project. Extract the runbook with the
   built-in macOS `textutil`.
8. **Local Node version.** The machine runs Node 25 (non-LTS). The Docker image and CI pin the
   current Node LTS. Phase 0 verifies the exact version.
9. **Local machine is arm64.** If the runbook says the server is amd64, local Docker tests run
   natively on arm64, and the release image is built for amd64 in CI.

## Pre-start decisions

| Date | Decision | Reason |
|------|----------|--------|
| 2026-10-21 | VibeWise learning mode off in this project | User request |
| 2026-10-21 | Write the progress note to `docs/PROGRESS.md` at about 95 % usage | User request |
| 2026-10-21 | Do not start Phase 0 until the user says start | User request |
| 2026-10-21 | Keep `docs/PROMPT.md` local only | Contains a local path and a domain name |
| 2026-10-21 | Pushing to `main` is allowed; bootstrap commit `64a012a` (`.gitignore` only) pushed to create `main` | User override of the brief; the remote repo was empty |
| 2026-10-21 | `.env.example` created (variable contract) and `.env` generated with random secrets and VAPID keys (mode 600) | User request. Third-party keys, R2 and `VAPID_SUBJECT` are left empty for the user |

## After the build (not in the brief, do not build)

- **Portainer.** The user asked on 2026-10-21 whether to manage the stack with Portainer.
  Proposed answer, to discuss after the build: deploy only through `deploy/deploy.sh`,
  because a Portainer stack redeploy skips the pre-deploy backup, the migrations, the
  readiness gate and the automatic rollback. Portainer is fine as a dashboard for status, logs and restarts.
  It mounts the Docker socket (root on the host), so it must be reachable only through
  Tailscale and bound to 127.0.0.1. Check in `docs/SERVER-NOTES.md` whether it already runs on the server.
