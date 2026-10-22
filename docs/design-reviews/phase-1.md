# Design review: Phase 1 (2026-10-22)

Impeccable passes for the Phase 1 surfaces (setup wizard, login, onboarding, dashboard, settings, offline).
The finish reviewer and documenter ran in-thread (degraded procedures) because the project allows subagents only for
Phase 0 research.

## Evidence

- Screenshot tour: `npm run screenshots` (fresh database, production build) writes 24 captures to
  `artifacts/screenshots/` (6 screens × 375/1440 px × light/dark) plus `a11y.json`. Not committed (local artifacts).
- axe-core (WCAG 2.0/2.1/2.2 A and AA tags) on every capture: **0 violations**.
- `impeccable detect --json src/app src/components`: **0 findings**.
- Tabular figures asserted in the browser (equal digit widths).
- PWA: manifest fields and icons fetched, service worker active with scope `/`.

## Audit health score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 4 | axe 0 violations in both themes and widths; skip link, labelled fields, `aria-current`, switch roles |
| 2 | Performance | 4 | Server Components, small client islands, self-hosted variable font with unicode ranges, no images |
| 3 | Theming | 4 | Every colour is a token; light and dark from one set of variables; select chevron moved to a token colour |
| 4 | Responsive | 3 | Fixed: segmented control, time input and small buttons were under 44 px on phones |
| 5 | Implementation integrity | 3 | Coherent world; the signature month line has no stations until Phase 2 data exists |
| **Total** | | **18/20** | **Excellent (minor polish)** |

No P0 or P1 issue remains open. Fixed in this pass (P1/P2): touch targets; global reduced-motion kill replaced by a
fade-only sheet; Commissioner replaced by Source Sans 3 (no tabular figures, D-032); dark rail made navy instead of
near-black; segmented control contrast; full-height desktop rail; owner-only backup toggle; zero amounts in ink.

## Finish review (in-thread)

- **disposition: fix** → fixed. The dashboard empty state referred to a "New expense" button that ships in Phase 2;
  the copy now explains the month line instead.
- Open by plan, not defects: the central Add (quick-add) button and the remaining destinations arrive in Phase 2,
  budget bars in Phase 3.
- Keep: the navy rail owning the shell, one action blue, hollow/filled stations, one-pixel rules, no cards.

## Documentation

`DESIGN.md` and `.impeccable/design.json` written from the built code (tokens in `src/app/globals.css`).
