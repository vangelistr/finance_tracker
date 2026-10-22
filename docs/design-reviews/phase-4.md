# Design review: Phase 4 (2026-10-22)

New: in-app notification banner (every screen) and the month-start page (`/monthly`).

- Tour: 16 screens × 375/1440 × light/dark plus quick-add; axe-core **0 violations**; detector 0 findings.
- Fix: the "Record a payment" button sat in the section header and wrapped on phones → moved under the hint.
- Fix: links to routes that ship later (monthly report, investing suggestion) no longer prefetch.
- Banner: soft accent ground, bell icon, title and body in the user's language, an Open link (44 px) and a dismiss
  button that marks the notification read.
- **disposition: ship** at this scope.
