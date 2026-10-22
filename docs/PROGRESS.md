# Progress

Last updated: 2026-10-22
Status: **Phase 0 done. Phase 1 (Foundation) in progress.**
Branch: `build/finance-tracker` (local, created from `main` at `64a012a`).
Last verified commit: `64a012a` on `main` (bootstrap). The Phase 0 commit hash is in `git log`.

## Phases

| Phase | Status | Commit |
|-------|--------|--------|
| 0 Research and plan | done | "Phase 0: research and plan" |
| 1 Foundation | in progress (see below) | — |
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

## Phase 1: state of the working tree (uncommitted)

Done and type-checked:
- Tooling: `tsconfig.json` (strict, TS 6 needs `types: ["node"]`), `next.config.ts` (standalone, security headers,
  next-intl plugin), `eslint.config.mjs` (flat, next core-web-vitals + typescript), `postcss.config.mjs`,
  `vitest.config.mts` (projects `unit`, `integration`); scripts `typecheck` = `next typegen && tsc --noEmit`,
  `build` = `next build` + `scripts/build-sw.mjs` + `scripts/build-scripts.mjs` (esbuild → `dist/worker.mjs`,
  `dist/migrate.mjs`, `dist/admin.mjs`).
- Pure libs + unit tests (34 passing): `src/lib/money.ts`, `src/lib/dates.ts`.
- Server: `src/server/env.ts` (zod), `db/` (client, collections + indexes, migrations), `auth/` (argon2id, HMAC
  session ids, TOTP, Mongo rate limits, cookies, current-user helpers, users service), `http/api.ts` (route wrapper:
  CSRF origin + double submit, auth levels, zod, one error shape), `push/send.ts`, `health.ts`.
- API routes: auth setup/login/login-totp/logout/register/password/totp start-enable-disable, invites, settings,
  onboarding complete, push subscribe/unsubscribe/test, health, ready.
- `src/proxy.ts`: CSP nonce, CSRF cookie, Origin check, redirect to /login without a session cookie.
- i18n: `src/i18n/request.ts`, `locale.ts`, `messages/el.json`, `messages/en.json` (key parity checked).
- Design: `PRODUCT.md` (Impeccable init, answered from the brief), direction contract in
  `.impeccable/surfaces/src-app-app-layout-tsx.md` (D-022), tokens in `src/app/globals.css`, components in
  `src/components/` (ui, shell, brand, auth, settings, push, pwa, data/month-line).
- Pages: setup wizard, login, 2FA, invite, onboarding (notification step only), dashboard (empty month), settings,
  offline; manifest, icons route, service worker template `src/pwa/sw.template.js`.
- Worker skeleton (`src/worker/`: clock, heartbeat, scheduler, empty job list) and CLIs (`src/cli/migrate.ts`,
  `src/cli/admin.ts`).

Next in Phase 1 (in order):
1. Lint + `next build` green; run the app against a local Mongo (Docker) and fix runtime issues.
2. Integration tests (Mongo): setup closes registration, login/TOTP/rate limit, CSRF, user A cannot read user B,
   migrations idempotent.
3. Dockerfile (multi-stage, standalone, non-root, HEALTHCHECK), `.dockerignore`, `docker-compose.yml` (app on
   127.0.0.1, mongo unpublished, migrate one-shot, worker, backup), `docker/mongo-init/`.
4. Backup image and scripts per PLAN §10 (+ new env vars in `.env.example` and `.env`); verify backup, retention,
   restore-test locally.
5. CI workflow + Dependabot per PLAN §11 (SHAs from `docs/research/github-ci-limits.md` §6); run each job's commands locally.
6. Playwright config, screenshots 375/1440 light/dark of setup, login, onboarding, dashboard, settings; Impeccable
   critique/audit/polish (degraded in-thread reviewer), then `DESIGN.md` via `/impeccable document`.
7. Verify Commissioner tabular figures in the browser.
8. Onboarding steps for income sources, categories and accounts come in Phase 2 (they need the Phase 2 CRUD).

## Open issues

- `npm install` ran on local Node 25 (vitest EBADENGINE warning only); image and CI use Node 24.22.1.
- Impeccable concept-seed needed one network call to impeccable.style (scope, mode, seed key only), run with the
  sandbox disabled; logged in D-022.
