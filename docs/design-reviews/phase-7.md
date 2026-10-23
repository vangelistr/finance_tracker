# Design review: Phase 7 (2026-10-23)

New: the tax/EFKA estimator (`/tax`), month-end reports (`/reports`, `/reports/[month]`) and their print layout.
Both screens follow the existing direction contract (Operate mode); shape decisions were taken from the brief.

- Tour: tax, reports and a report × 375/1440 × light/dark plus a print capture; axe-core **0 violations**; detector 0
  findings; new horizontal-overflow guard: 0 screens wider than the viewport.
- Tax: the disclaimer opens and closes the page; every section title carries "(estimate)"; the first figure is what
  to move to the tax reserve now, with the reserve balance and what moved this year beside it. Year to date and the
  whole-year projection sit side by side on desktop; the prepayment is a cash line marked [uncertain]. The invoice
  table shows net, VAT, income tax and the set-aside with a one-tap move; the VAT-crossing invoice gets a warning with
  icon and words. The month table shows the EFKA effect that releases income tax, so the cumulative column explains
  itself. The rate panel shows every rate with its source id (link), the review date and [uncertain] tags, and the
  open questions for an accountant close the page.
- Report: title is the month, then the snapshot date and the immutability note; four figures (income, expenses, left
  over with sign, savings rate) with the change against the previous month in words; top categories with their
  chart colour and share; budgets with "over budget" in danger red plus the percentage; goals; next month's fixed
  costs with a total; the tax reserve block as an estimate. Print: A4, light, no navigation, two columns.
- Fix: "to move now" could exceed the year-to-date total (it ignored EFKA's income-tax release) → same basis (D-062).
- Fix: the month table overflowed at 1440 px ("month not over") → "in progress" / "σε εξέλιξη"; month names no-wrap.
- Fix: the mobile tax page was 656 px wide → scroll wrappers positioned (D-064).
- Fix: the renewals total reused the tax label "Total to set aside" → "Total".
- Fix: Greek "Σήμανε" tripped the investing wording test ("σήμα") → "Όρισε"; "Forecast" in a tax hint → "estimate".
- **disposition: ship** at this scope.
