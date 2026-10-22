# Design review: Phase 5 (2026-10-22)

New: savings goals (`/goals`) and the Smart Plan (`/plan`); goal stations on the calendar.

- Tour: 18 screens × 375/1440 × light/dark plus quick-add; axe-core **0 violations**; detector 0 findings.
- Goals: one row per goal, no cards. Name (opens the edit sheet), saved of target in tabular figures, an ochre progress
  meter (`role="meter"`), then required monthly, deadline, projected month at the current pace, and an Add money
  button. The emergency fund carries a shield icon and sorts first; the "Create an emergency fund" action shows only
  while none exists.
- Smart Plan: the disclaimer sits above the result on every render. The split is a thin four-part bar plus a table with
  amount, share (adds to 100.0 %) and the rule that produced each part, with the default shown next to any override.
  Mode is in words (danger notice for a deficit, warning for a squeeze). Blocks follow the methodology order: baseline,
  essentials, emergency fund, goals, this month; each opens with its formula on a ruled left margin.
- Fix: at 375 px the Share header and "100,0 %" wrapped → no-wrap on numeric columns.
- Fix: the four-column essentials table hyphenated its headers on phones → average and budget move under the category
  name below 640 px; the used value stays in its column.
- Fix: "Πλάνο για Οκτώβριος 2026" was ungrammatical Greek (nominative after "για") → the header meta is the month alone.
- Fix: mid-month, "short of the baseline" read like a problem before payday → "Received so far" and "Still missing to
  reach the baseline".
- Fix: the "Why these rules" summary lost its disclosure marker under flex → explicit chevron that turns when open.
- **disposition: ship** at this scope.
