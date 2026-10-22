# Design review: Phase 3 (2026-10-22)

New: dashboard charts (spending by category, income by source, income vs spending by month, net worth), budget bars,
range filter, budgets page.

## Evidence

- `npm run screenshots` (14 screens × 375/1440 × light/dark): axe-core **0 violations**; `impeccable detect` 0 findings.
- Unit tests read every chart's numbers back from the rendered markup (fixture totals), plus the aggregate functions.

## Findings and fixes

- A hidden data table with `sr-only` on the `<table>` stretched the page (tables ignore a 1 px height), so the desktop
  rail stopped short of the bottom → the wrapper is hidden instead.
- Net worth started months before any account existed → the line starts at the first account's month; the latest value
  is marked as a station so a one-month history is still visible.
- The long Greek "overall budget" label overlapped its input → labels wrap.
- Budget states follow the One Meaning rule: neutral ink on track, amber with an icon from the first threshold, red with
  an icon when over; the text always says how much is left or over.

## Finish review (in-thread)

- **disposition: ship** at this scope.
