# Design review: Phase 8 (2026-10-23)

Final polish pass over the whole app after Phases 6 and 7 added investing, tax and reports.

- Tour: 106 captures (every main screen × 375/1440 × light/dark, plus quick-add, add-instrument sheet and a print
  capture); axe-core **0 violations**; horizontal overflow **0 screens**; Impeccable detector over all of `src/`:
  0 findings.
- Navigation: Reports and Tax & EFKA joined the rail and the phone "More" sheet; Investing appears only while the
  module is on (the tour checks both states).
- Fix: donut shares printed "79.5%" in Greek → "79,5 %" (D-068).
- **disposition: ship.**
