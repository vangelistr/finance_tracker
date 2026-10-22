# Design review: Phase 2 (2026-10-22)

New surfaces: quick-add sheet and central Add button, transactions ledger, income (sources and payments), fixed costs
and subscriptions, accounts and transfers, categories, calendar (desktop grid, phone agenda line), onboarding steps,
offline quick-add, and the dashboard with real data. In-thread finish review and documentation (degraded procedures).

## Evidence

- `npm run screenshots`: fresh database, 13 screens × 375/1440 px × light/dark (52 captures) plus the quick-add sheet,
  axe-core on every capture: **0 violations**. The same run proves the offline queue: an expense saved offline is
  synced exactly once after reconnecting.
- `impeccable detect`: 0 findings after recording the Micro and Nav type steps in `DESIGN.md`.
- CI smoke (`tests/e2e/smoke.spec.ts`) passes locally against `docker compose`.

## Findings and fixes

- Month line: the "today" capsule hid the stations on the current day → today is now a tick drawn under the stations.
- New income sources defaulted to the alphabetically first category → default by type (salary, ergosimo, freelance).
- Detector advisories (0.6875rem, 0.9375rem) were real, reused steps → added to `DESIGN.md` as Micro and Nav.

## Finish review (in-thread)

- **disposition: ship** at this scope. The navy rail, hollow/filled stations, one action blue, ledger rows under
  one-pixel rules and the vertical agenda line carry the direction contract into the working screens.
- Open by plan: budgets and charts (Phase 3), goals and plan (Phase 5).
