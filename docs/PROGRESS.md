# Progress

Last updated: 2026-10-22
Status: **Phases 0 and 1 done. Next: Phase 2 (Core).**
Branch: `build/finance-tracker` (local, created from `main` at `64a012a`).
Last verified commit: the "Phase 1: foundation" commit on `build/finance-tracker` (Phase 0: `6f22361`).

## Phases

| Phase | Status | Commit |
|-------|--------|--------|
| 0 Research and plan | done | `6f22361` |
| 1 Foundation | done | "Phase 1: foundation" (see `git log`) |
| 2 Core | not started | — |
| 3 Dashboard, charts, budgets | not started | — |
| 4 Notification worker | not started | — |
| 5 Savings goals + Smart Plan | not started | — |
| 6 Investing module | not started | — |
| 7 Month-end report + tax/EFKA | not started | — |
| 8 Release, deploy, hardening, handoff | not started | — |

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

## Open issues

- `npm install` ran on local Node 25 (vitest EBADENGINE warning only); image and CI use Node 24.22.1.
- Impeccable concept-seed needed one network call to impeccable.style (scope, mode, seed key only), run with the
  sandbox disabled; logged in D-022.
