# Product

<!-- impeccable:product-schema 1 -->

Source of every fact below: the owner's written build brief (2026-10-21). The build runs hands-off, so the
init interview was answered from that brief instead of a live interview; nothing here was invented beyond it.

## Platform

web

(An installable PWA used mainly on a phone, also on a desktop browser. Not a native app.)

## Users

- **Primary user:** the owner, one person in Greece who earns from several sources at once: a full-time salary,
  a part-time fixed salary, irregular per-job pay (Greek "εργόσημο", paid whenever they are called for work) and
  one-off freelance invoices or closed deals.
- **Job:** keep an honest, current picture of money in and money out, log expenses in seconds right after they
  happen, see where the month stands, and decide each month how much goes to essentials, fun, savings and investing.
- **Other users:** accounts invited later by the owner on the same server. Every user's data is fully isolated.

## Product Purpose

Finance Tracker is a private, self-hosted personal finance app. It tracks income (expected vs received) and
expenses (one-off, fixed recurring, subscriptions), keeps budgets per category, shows charts, reminds the user to
log spending, alerts before renewals and on overspending, sets aside estimated tax and EFKA for freelance income,
and suggests a monthly split of income with the formula shown. An optional investing module ranks a watchlist by
past-performance criteria, for education only.

Success: the owner logs every expense the same day, never misses a renewal or a tax set-aside, and starts each
month knowing what last month looked like and what this month's income will be.

## Positioning

Built for a mix of fixed and irregular Greek income: it plans from a conservative baseline instead of an average,
estimates Greek tax/EFKA set-asides with versioned, sourced rates, and runs entirely on the owner's own server,
reachable only through their private network. No bank connection, no third party ever sees the data.

## Operating Context

- Evening logging on a phone after the 21:00 reminder, often in low light; quick-add must take under 5 seconds.
- Month start (the 1st, 09:00): one notification leads to last month's report, a pre-filled "this month's income"
  form with the expected recurring incomes, and (if enabled) the monthly investing suggestion.
- Occasional desktop sessions for planning, tax set-asides, goals and reports; reports print to A4/PDF.
- Reached only over Tailscale on HTTPS; push notifications need the PWA installed (iOS 16.4+ Home Screen).
- Offline: the app shell opens and new expenses queue on the device until the connection returns.

## Capabilities and Constraints

- Greek UI by default with an English toggle. Currency EUR by default. Time zone Europe/Athens; dates and
  calendars must stay correct across month edges and daylight-saving changes.
- Income source types: recurring fixed, recurring variable (irregular), one-time. Entries are "expected" or
  "received". Expenses are one-off or fixed recurring; a fixed expense can be a subscription
  (renewal date, billing cycle, active / paused / cancelled).
- Accounts: checking, cash, savings, investment, monthly bills and a tax reserve bucket; transfers between them.
- Budgets per category and overall; overspend alerts at 80 % and 100 % by default.
- Recurring calendar: expected vs paid/received, colour-coded, tap a day to add or confirm; agenda list on mobile.
- Savings goals with progress, required monthly amount and projected completion date.
- Smart Plan: essentials / discretionary / savings / investing split with editable percentages and the formula shown.
- Month-end report: an immutable monthly snapshot, viewable in-app and printable.
- Tax/EFKA estimator for freelance invoices, rates from a versioned per-year config with source links.
- Investing module: OFF by default; when off there is no investing UI, navigation or network call.
- Terminology: "expected" vs "received"/"paid"; "estimate"; "educational, not financial advice";
  investing output is "ranked by past-performance criteria", never a prediction or a buy/sell signal.
- Money is exact (integer cents) and shown with tabular figures.

## Brand Commitments

- Name: "Finance Tracker". No logo exists yet.
- Required feel, set by the brief: calm, trustworthy, clean but data-rich fintech; it must look polished and
  never like a generic AI template.
- Required wording on figures: tax, allocation and ranking numbers are always labelled as estimates or educational;
  tax figures say "estimate, not tax advice; confirm with an accountant".

## Evidence on Hand

- No real user data, testimonials, screenshots or marketing assets exist. Do not fabricate any.
- Seed data is limited to sensible Greek default expense categories and an editable starter investing watchlist.

## Product Principles

1. **Seconds, not minutes.** Logging an expense is the most frequent job; it must be the fastest path on every screen.
2. **Expected is not received.** Every figure makes clear whether money is planned or real.
3. **Show the working.** Every suggestion, estimate and ranking shows its inputs, formula, sources and data age.
4. **Private by construction.** Nothing leaves the owner's server except their own encrypted backups.
5. **Honest about uncertainty.** Estimates are labelled; unverifiable rules are marked [uncertain], never hidden.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast in light and dark themes; colour is never the only signal (expected vs done, charts).
- Thumb-reachable primary actions on mobile; 44 px touch targets; full keyboard use on desktop.
- Greek text is longer than English: layouts wrap rather than truncate; money values never truncate.
- `prefers-reduced-motion` respected.
