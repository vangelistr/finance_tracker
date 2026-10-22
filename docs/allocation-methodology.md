# Smart Plan allocation methodology

## 1. Header

**Purpose.** This document fixes the rule behind the Smart Plan: how the app turns income, fixed
costs and savings goals into a monthly split (essentials, discretionary, savings, investing). It
gives the evidence, the exact formulas, pseudo-code for the pure functions, worked examples and
edge cases. Phase 5 implements it. Unit tests are built from the worked examples in section 4.

**Research read date:** 2026-10-22. Every cited page was opened in this research task on that date.
Where a page could not be opened (HTTP 403 or no readable text), the claim is not cited or is tagged
`[uncertain]`.

**Disclaimer (shown with every recommendation):** *Educational, not financial advice.* The numbers
are generic rules of thumb applied to the user's own data. They are not tailored advice, not a
prediction and not a buy or sell signal.

**Conventions.** Money is integer euro cents (`Cents`). Percentages are integer basis points
(`Bp`, 10 000 = 100 %). Months are calendar months in Europe/Athens (`YYYY-MM`). "Complete month"
means a month that ended before the current month. Citations are written as
(name, URL, read 2026-10-22).

**What is evidence and what is design.** The sources give rules of thumb (3 to 6 months, lowest
month, save in good months, emergency fund before investing). They give no exact numbers for the
parameters the app needs (6-month window, 25 % irregular threshold, 10 % investing default, 5 %
savings floor, and so on). Those are design decisions. Each one is labelled "Decision" and listed in
section 8.

## 2. Frameworks

### 2.1 50/30/20 (Warren and Tyagi)

**What it says.**
- The framework comes from the book *All Your Worth* by Elizabeth Warren and Amelia Warren Tyagi.
  The publisher page says it splits money into three parts: the Must-Haves ("the bills you have to
  pay every month"), the Wants ("some fun money for right now") and Savings ("to build a better
  tomorrow"). It adds: "No complicated budgets, no keeping track of every penny."
  (Simon & Schuster publisher page, https://www.simonandschuster.com/books/All-Your-Worth/Elizabeth-Warren/9780743269889, read 2026-10-22)
- The percentages (50 % Must-Haves, 30 % Wants, 20 % Savings) are not on the publisher page. A
  review describes them: needs "include housing, transportation, groceries, insurance, and clothes
  you really need", and savings are "20% ... including debt repayment". The same review says the
  savings part is split 10 % retirement, 5 % home, 5 % other goals, and lists a sequence: $1,000
  emergency fund, repay debt, "bolster your emergency fund to cover six months of Needs", then save
  and invest for wealth.
  (Get Rich Slowly review, https://www.getrichslowly.org/book-review-all-your-worth/, read 2026-10-22)
  This is a reviewer's description, not the book text. Treat the percentages and the sequence as
  `[uncertain]` until checked against the book. The book's year (commonly given as 2005) is also not
  on the page I read.

**Evidence and limits.**
- I found no study that shows 50/30/20 is optimal. It is a rule of thumb from a book.
- A fixed 50 % for needs can be unrealistic. Eurostat reports that in 2024, 8.2 % of people in the EU
  lived in households spending 40 % or more of disposable income on housing, and the highest rate
  was in Greece, 28.9 %.
  (Eurostat, "Living conditions in Europe - housing", https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/67027.pdf, read 2026-10-22)
  So for a Greek user, essentials above 50 % of income are common. The app must not force 50 %.

**How the app uses it.**
- Keep the three-bucket idea and a 30 % default for discretionary spending.
- Essentials come from the user's own data, not from a fixed 50 %.
- Savings and investing share what is left. When essentials are about 50 %, the defaults land close
  to 50/30/20 (savings plus investing about 20 %).
- The default investing share of 10 % of the baseline mirrors the review's "10 % retirement" part
  (`[uncertain]` source, see above).

### 2.2 Pay yourself first

**What it says.**
- The CFPB emergency-fund guide advises, for money you receive, to "pay yourself first by putting a
  portion of it automatically into savings". It has a section "Make your saving automatic" and
  suggests recurring transfers, or splitting direct deposit between two accounts. It also notes that
  "building a savings of any size is easier when you're able to consistently put money away".
  (CFPB, An essential guide to building an emergency fund, https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/, read 2026-10-22)
- The investor bulletin "Investor Resilience - World Investor Week 2022" (CFTC copy; a search result
  says it was issued jointly by US securities and commodities regulators, which I did not confirm on
  the page) lists "Save automatically", for example by direct deposit to a savings account with each
  paycheck.
  (CFTC copy of the bulletin, https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/keytopicsforworldinvestorweek2022, read 2026-10-22.
  The investor.gov copy returned HTTP 403, so I cite the CFTC copy.)
- FINRA: "the most important thing is to start the habit of saving".
  (FINRA, https://www.finra.org/investors/insights/start-emergency-fund, read 2026-10-22)

**Evidence and limits.** These are consumer-education pages. They support the habit (save first,
automatically, even a small amount). They give no percentage.

**How the app uses it.**
- Savings is planned before discretionary spending. A small savings floor is protected when money is
  tight (default 5 % of the baseline). Decision: the 5 % figure is a design choice. It is small on
  purpose, in line with "start the habit".
- The plan produces a transfer per goal each month (`source: plan` contributions), so saving can be
  done at the start of the month.

### 2.3 Emergency fund sizing and placement

**What the sources say (size).**

| Source | Size | Notes |
|--------|------|-------|
| MoneyHelper (UK), emergency savings | "three to six months' essential outgoings" | Example: 1,000 pounds of essentials gives 3,000 to 6,000 pounds. Essentials are rent or mortgage, food, heating "and other things you can't live without". (https://www.moneyhelper.org.uk/en/savings/types-of-savings/emergency-savings-how-much-is-enough, read 2026-10-22) |
| MoneyHelper, irregular income page | "three months' essential outgoings", and "even having a month's income saved will protect you against some income shocks" | (https://www.moneyhelper.org.uk/en/everyday-money/budgeting/how-to-budget-for-an-irregular-income, read 2026-10-22) |
| Investor bulletin (CFTC copy) | "such as 3-6 months of living expenses" | (https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/keytopicsforworldinvestorweek2022, read 2026-10-22) |
| Vanguard | Income shocks: "at least 3 to 6 months of living expenses". Spending shocks: "at least $2,000 or enough money to cover 2 to 4 weeks of expenses". Save more if "Your income isn't steady" | (https://ownyourfuture.vanguard.com/content/en/learn/financial-planning/whats-the-right-emergency-savings-amount.html, read 2026-10-22). A second Vanguard page says income variability is "one of the most important factors" for fund size and advises "Contributing more during high-earning periods" (https://investor.vanguard.com/investor-resources-education/article/understanding-income-volatility-and-emergency-saving, read 2026-10-22) |
| FINRA | "three to six months of living expenses"; "those with variable income or specialized careers might need a larger reserve than those with stable jobs" | (https://www.finra.org/investors/insights/start-emergency-fund, read 2026-10-22) |
| CFPB | No number. "The amount you need ... depends on your situation." Look at the unexpected costs you had before | (https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/, read 2026-10-22) |
| Warren and Tyagi (via review) | Six months of Needs, after a $1,000 starter fund and debt repayment | Secondary source, `[uncertain]` (https://www.getrichslowly.org/book-review-all-your-worth/, read 2026-10-22) |
| JPMorgan Chase Institute | A family needs "about six weeks of take-home income in liquid assets" to cover an income dip and a spending spike at the same time. 65 % of families lacked it | US Chase customers only, a short-term buffer, not a job-loss fund (https://www.jpmorganchase.com/institute/all-topics/financial-health-wealth-creation/report-weathering-volatility-2-a-monthly-stress-test-to-guide-saving, read 2026-10-22) |

**Reading across the sources.**
- 3 to 6 months of essentials is the common range. Every source that gives a number agrees.
- Vanguard and FINRA say to hold more when income is not steady. Neither gives a number of months.
  MoneyHelper's irregular-income page names three months as a good level and one month of income as
  a minimum that helps. The JPMorgan work is about a short-term buffer. So the brief's "6 months for
  irregular income" is a decision at the top of the 3 to 6 range, not a sourced figure.
  Tag: `[uncertain]` (not sourced).
- The base is essentials, not total spending (MoneyHelper, Vanguard "living expenses").
- A starter fund helps. Vanguard's 2 to 4 weeks and Warren and Tyagi's $1,000 both set a first
  small step. The app shows progress toward the target and does not demand the full target first.

**Where to keep it.**
- Bank or credit union account: CFPB ("generally considered one of the safest places"), the investor
  bulletin ("keep in a bank or credit union").
- Liquid and interest-bearing, accessible without penalty: FINRA.
- Instant access savings account: MoneyHelper.
- Vanguard says income-shock money can sit in a taxable brokerage account or Roth IRA ("accessible
  but not necessarily free from market risks") and that people more exposed may prefer cash.
  The app does not follow that option. The Smart Plan treats the emergency fund as cash, in a
  `savings` account, because the banking sources agree on it.

**How the app uses it.**
- Target = months x essentials, with months = 3 (fixed-income profile) or 6 (irregular profile).
  The user can override the months.
- The emergency fund is the first claim on the savings share (section 3.6).
- The Smart Plan labels the target "rule of thumb, not a personal need". The CFPB says the real
  amount depends on the user's situation.

### 2.4 Irregular-income budgeting

**What the sources say.**
- Baseline from the low months. MoneyHelper: "A good tip is to budget for your lowest monthly income
  - at least you'll always have the major costs covered. Then, if you have a good month, you can
  revise your monthly budget up or put the extra into savings." It also offers an alternative: total
  the last year and divide by 12 to get an average.
  (MoneyHelper, https://www.moneyhelper.org.uk/en/everyday-money/budgeting/how-to-budget-for-an-irregular-income, read 2026-10-22)
- Budget from outgoings you can know. Same page: you may not know what comes in, "but you should
  have a good idea about how much is going out". List essential outgoings first. It suggests a
  separate account for regular outgoings that is topped up in a higher-income month. It also says
  to set money aside for tax when self-employed, and to plan for high-cost months.
- Extra in a good month: "avoid the temptation to just spend the extra cash"; build an emergency
  fund to "get you through times when your income might be lower" (same page).
- CFPB: income can be regular ("a set schedule and amount") or irregular, and "it can be helpful to
  save during months that you earn more money so you have enough to pay for living expenses when you
  earn less money". The CFPB income tracker asks users to know which income is "regular, irregular,
  seasonal, and one-time-only".
  (CFPB Building Blocks teacher guide, "Tracking income", Summer 2022, copy at https://fhi360.org/sites/default/files/media/documents/cfpb_building_block_activities_tracking-income_guide.pdf, read 2026-10-22;
  CFPB Income and benefits tracker, https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_income_benefits_tool_2018-11_ADA.pdf, read 2026-10-22)
- CFPB emergency-fund guide: "use the weeks when you have more money available to move a little
  extra into savings", and consider putting all or part of a lump sum into savings.
  (https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/, read 2026-10-22)
- Vanguard: "Contributing more during high-earning periods means you have savings to lean on."
  (https://investor.vanguard.com/investor-resources-education/article/understanding-income-volatility-and-emergency-saving, read 2026-10-22)
- YNAB's page lists "For Later: Anticipate irregular expenses and set aside manageable monthly
  amounts". That is about irregular expenses, not income.
  (https://www.ynab.com/ynab-four-rules-budgeting, read 2026-10-22). The page I opened does not
  state a "budget only money you have" rule, so I do not cite YNAB for that idea.

**Income volatility evidence (JPMorgan Chase Institute, October 2019, Chase checking customers).**
- The median family's income changed 36 % month to month during the prior year, and this was roughly
  flat from 2013 to 2018.
- Families have large income swings in "almost five months out of a year". Income spikes are about
  twice as common as dips. Lower-income families have the largest dips.
- The report says that saving a fixed share of income may leave too little buffer in bad months and
  under-save in good months, and that families may need to save more in income-spike months.
  (https://www.jpmorganchase.com/institute/all-topics/financial-health-wealth-creation/report-weathering-volatility-2-a-monthly-stress-test-to-guide-saving, read 2026-10-22)
- Limit: US data, Chase customers only. It is evidence that volatility is common, not a Greek
  statistic. I found no Greek income-volatility figure. `[uncertain]` for Greece.

**Greek context.** The εργόσημο is a voucher used to pay occasional workers. It is issued by the
person who uses the service. The recipient redeems it, and part of its face value is withheld for
social-insurance contributions. The 2011 ministry circular I opened does not state the percentages,
and later changes are not checked. `[uncertain]` (taxheaven.gr publishes the circular text; it is a
private legal-news site, not an official portal. https://www.taxheaven.gr/circulars/12366, read 2026-10-22)
For the app this means the entered εργόσημο amount should be the net amount the user receives.

**Decision: why the lowest month, not the median.**
- MoneyHelper, the one source that gives a concrete baseline rule, says lowest month.
- With a median baseline, about half of the months fall below the baseline by definition (simple
  arithmetic). That is the opposite of "budget only for money you will have". The sources give no
  rule that prefers the median for a budget, so I do not use it.
- With the minimum, the plan is always funded, and every euro above it is handled by the surplus
  rule (section 3.7), which sends it to savings first. The cost of being too low is small. The cost
  of being too high is a deficit.
- The minimum is sensitive to one bad month. Mitigation: a manual baseline override, and the plan
  shows the median next to the minimum so the user can see the gap.

**How the app uses it.** Section 3.1 (baseline), 3.7 (surplus). The app never plans against money
that has not been received: `one_time` income is never in the baseline.

### 2.5 Priority ordering

**What the sources say.**
- Warren and Tyagi, as described by a review: $1,000 emergency fund, then debt, then a six-month
  fund, then saving and investing for wealth. `[uncertain]` secondary source
  (https://www.getrichslowly.org/book-review-all-your-worth/, read 2026-10-22).
- MoneyHelper: pay priority debts such as credit card debt before building the emergency fund, but
  "if you're keeping up with mortgage repayments and any other credit you have is low cost,
  temporary or well under control, it's a good idea to add to your emergency fund". It also says
  that once the target is met, you can continue the regular amount "to fund other savings goals".
  (https://www.moneyhelper.org.uk/en/savings/types-of-savings/emergency-savings-how-much-is-enough, read 2026-10-22)
- FINRA: paying down high-interest debt can beat investing: "The money you save by paying off
  high-interest debt might exceed the average returns available from most investments."
  (https://www.finra.org/investors/personal-finance/manage-your-debt, read 2026-10-22)
  FINRA does not set a fixed order between debt payoff and the emergency fund: "you'll have to
  decide how to balance" them (https://www.finra.org/investors/insights/start-emergency-fund, read 2026-10-22).
- The investor bulletin lists having an emergency fund as its first resilience tip, and says
  without one "even a small financial upset can result in a long-term debt"
  (https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/keytopicsforworldinvestorweek2022, read 2026-10-22).
- Vanguard says income-shock savings can be held in a taxable brokerage account or Roth IRA. My
  reading: this shows the sources do not treat "cash full before any investing" as a universal rule,
  which is why the gate can be switched off.
  (https://ownyourfuture.vanguard.com/content/en/learn/financial-planning/whats-the-right-emergency-savings-amount.html, read 2026-10-22)

**Reading across the sources.** The consensus order is: starter cushion, high-cost debt,
emergency fund, then other goals and long-term investing. The exact order between debt and the
fund is left to the person. The sources do not give a numeric trigger for when investing may start.

**Decisions for the app.**
1. The app does not track debt. High-interest debt appears only as a user-entered essential (the
   minimum payment, part of fixed costs) or as a user-created goal (extra payoff). The Smart Plan
   cannot put debt before the emergency fund. The UI shows a hint: "If you have high-interest debt,
   compare paying it down with building savings (FINRA)". The hint is text only.
2. The emergency fund is the first claim on savings.
3. Investing starts only when the emergency fund holds at least 3 months of essentials (the "gate").
   3 months is the low end of every source's range. Until then, the investing share is redirected to
   savings (it flows to the emergency fund). The user can turn the gate off. Decision: the 3-month
   gate is not sourced as a number. It is a design choice built on the common order above.

## 3. Final rule

All functions are pure and deterministic: no clock, no random numbers, no database. The caller passes
`today` (a `YYYY-MM-DD` local date in Europe/Athens) and plain data. Field names follow `docs/PLAN.md`
section 4 (`categories.essential`, `income_sources.type`, `expectedNetMinor`, `goals`,
`goal_contributions`).

### 3.0 Default parameters (all user-overridable, stored in `users.settings.plan`)

| Parameter | Default | Meaning | Basis |
|-----------|---------|---------|-------|
| `baselineWindowMonths` | 6 | Complete months used for the variable-income baseline | Brief ("last 6 months") |
| `essentialsWindowMonths` | 3 | Complete months used to average variable essential spending | Decision |
| `discretionaryBp` | 3000 (30 %) | Discretionary share of the baseline | "Wants 30 %" in 50/30/20 (secondary source, section 2.1) |
| `investingBp` | 1000 (10 %), 0 allowed | Investing share of the baseline | "10 % retirement" part of the 20 % (secondary source). Decision |
| `minSavingsBp` | 500 (5 %) | Savings floor protected when money is tight | Decision, "start the habit" (FINRA, CFPB) |
| `efMonthsFixed` | 3 | Emergency-fund months, fixed-income profile | Common range 3 to 6 (MoneyHelper, Vanguard, FINRA) |
| `efMonthsIrregular` | 6 | Emergency-fund months, irregular profile | Top of the range, brief. Not sourced as a number |
| `efGateMonths` | 3 | Months of essentials the emergency fund must hold before investing starts | Decision |
| `investWhileEfUnfunded` | false | Turns the gate off | User choice |
| `irregularShareBp` | 2500 (25 %) | Irregular-profile threshold | Decision, not sourced |
| `surplusDiscretionaryBp` | 1000 (10 %) | Share of surplus the user may spend freely | Decision |
| `profileOverride` | null | Force `fixed` or `irregular` | User choice |
| `manualVariableBaselineMinor` | null | Replace the computed variable baseline | User choice |

### 3.1 Baseline income (what the plan is built on)

`baseline B = F + V`. `one_time` income is never part of B.

**F, recurring_fixed.** Sum of `expectedNetMinor` of all active `recurring_fixed` sources, converted to
a monthly amount: `monthly = roundHalfUp(amount x periodsPerYear / 12)` (weekly 52, every two weeks 26,
monthly 12, quarterly 4, yearly 1). Net amounts only (after tax and contributions). A source is active
in a month if it started on or before the month's last day and has not ended before its first day.
Expected, not received: a fixed salary is planned from its schedule. If a fixed salary was not paid
(status `expected` or `skipped`), the plan still uses F, and the surplus rule (3.7) shows a shortfall.

**V, recurring_variable.** Decision: V is the **minimum** monthly total of the window.
1. Window: up to `baselineWindowMonths` (6) complete calendar months before the current month, but not
   earlier than the first month in which a `recurring_variable` source had a received (`done`) entry.
2. Count a month only if at least one `recurring_variable` source was active in it.
3. Month total = `max(0, sum of done income transactions of recurring_variable sources in that month)`.
   Negative or refunded amounts reduce the month. A month below zero counts as 0.
4. A counted month with no income counts as **0** (a zero-income month is real information).
5. `n` = number of counted months.
   - `n = 0`: `V = 0`, confidence `none`. The UI asks for a manual baseline or waits for history.
   - `n = 1 or 2`: `V = min(months)`, confidence `provisional`.
   - `n = 3, 4 or 5`: `V = min(months)`, confidence `partial`.
   - `n = 6`: `V = min(months)`, confidence `full`.
6. If `manualVariableBaselineMinor` is set, `V` is that value, method `manual`, and the computed
   minimum stays visible.
7. For information only, the plan also shows the median and the mean of the same months and the
   gap between V and the median.

Why the minimum (section 2.4): MoneyHelper says to budget for the lowest month. Everything above V
is handled by the surplus rule, so being conservative costs little. Why 6 months: the brief. The
months are complete months only, so the current month never shifts its own plan. Expected entries
(`status: expected`) never count toward V.

### 3.2 Essentials

`E = Efixed + Evar`.
- `Efixed` = sum of `amountMinor` (monthly equivalent) of active `recurring_expenses` whose category
  has `essential = true`. Include debt minimum payments and insurance when the user marks them
  essential. Yearly bills are divided by 12.
- `Evar` = sum over essential categories `c` of `max(avg_c, budget_c)`.
  - `avg_c` = `roundHalfUp(mean of month totals)` over the last up to `essentialsWindowMonths` (3)
    complete months. Month total = `max(0, sum of done expense transactions in c with no
    recurringExpenseId)` (so recurring items are not counted twice). If there are no complete months
    of data, `avg_c = 0`.
  - `budget_c` = the monthly budget for `c` if one exists, else 0.
  - Taking the larger of the two follows the logic that underestimating essentials is the risky
    error. Decision, not sourced.
- MoneyHelper's irregular-income page says to list the important regular outgoings first (rent or
  mortgage, travel, phone, electricity and gas, insurance, council tax, food). The app mirrors that
  with `categories.essential`.

### 3.3 Income profile and emergency-fund target

- Over the last 6 complete months compute received income by type: `Rfixed`, `Rvar`, `Rone`
  (each `max(0, sum)`).
- `irregularShare = (Rvar + Rone) / (Rfixed + Rvar + Rone)` in basis points.
- Profile is `irregular` if `irregularShare >= irregularShareBp` (25 %). If the total is 0, the profile
  is `irregular` when the user has no active `recurring_fixed` source, otherwise `fixed`.
  `profileOverride` wins if set.
- `efMonths` = 6 if irregular, else 3 (or the user's number, 1 to 12).
- `efTargetFormula = efMonths x E`.
- `efTarget` = the target of the goal with `isEmergencyFund = true` if it exists and is greater than
  0, otherwise `efTargetFormula`. When the goal target differs from the formula, the UI shows the
  formula as a suggestion ("Set target to ...").
- `efSaved` = sum of contributions to that goal (0 if no such goal; the UI then offers to create it).
- `gate = min(efGateMonths x E, efTarget)`.
- Decision on the 25 % threshold: no source gives one. Rationale: a fixed salary plus a small side
  income should not double the cushion, while an income that is a quarter or more variable is
  materially exposed. The JPMorgan evidence (median 36 % month-to-month change, large swings in
  almost five months a year) shows volatility is common; it does not define a threshold.

### 3.4 The monthly split (order of operations)

Inputs: B, E, `discretionaryBp`, `investingBp`, `minSavingsBp`, optional `essentialsBpOverride`,
`efSaved`, `gate`, `investWhileEfUnfunded`. All parts are integer cents and sum to B.

1. **Zero baseline.** If `B <= 0`: every part is 0, mode `deficit`, `shortfall = E`. Stop.
2. **Essentials.**
   - No override: `Es = min(E, B)` and `shortfall = E - Es`.
   - Override: `Es = min(floor(B x essentialsBp / 10000), B)`, `shortfall = 0`.
3. **Remainder.** `R = B - Es`.
4. **Wanted amounts.** `Dw = floor(B x discretionaryBp / 10000)`, `Iw = floor(B x investingBp / 10000)`.
5. **Gate.** `gateOpen = investWhileEfUnfunded or efSaved >= gate`. `Ie = gateOpen ? Iw : 0`.
6. **Savings floor.** `Sf = min(R, floor(B x minSavingsBp / 10000))`.
7. **Normal mode** if `R - Dw - Ie >= Sf`:
   `D = Dw`, `I = Ie`, `S = R - D - I`. Savings is the remainder, so it includes any investing share
   the gate held back.
8. **Squeeze mode** otherwise (money is tight):
   `rest = R - Sf`, `D = min(Dw, rest)`, `I = min(Ie, rest - D)`, `S = R - D - I`
   (so `S >= Sf`). Priority when tight: essentials, then the savings floor, then discretionary,
   then investing. Rationale: pay-yourself-first protects a small saving (CFPB). Investing is last
   because it is optional, is the last step in the usual order (section 2.5), and is zero anyway
   until the emergency fund is funded. No source ranks discretionary against investing.
   Decision.
9. **Deficit mode.** If `E >= B` (no override), then `R = 0`, so `D = I = S = 0` and `Es = B`.
   Mode `deficit`. The UI shows "Your essentials (E) are X above your baseline" and links to fixed
   costs. The plan never invents negative parts.
10. **Held-back investing** (information): `investingHeld = S(gate closed) - S(gate open)`, computed
    by running steps 5 to 8 twice. It is the amount the gate sends to savings instead of investing.

**User overrides.** The user can set `essentialsBpOverride`, `discretionaryBp` and `investingBp`
(each 0 to 10 000). Savings is always the balance, so the four parts always sum to 100 %. An
override replaces the default wanted amount; it does not switch off squeeze or deficit logic. If the
overrides add up to more than 100 %, squeeze mode scales them down by the priority above, and the UI
says so. All overrides at 0 puts the whole baseline into savings (and the gate redirect has no
effect). Overrides are saved, and the UI always shows the default next to the user's value.

### 3.5 Investing share

- `investing = Ie` as above: a configurable percentage of the baseline, default 10 %, 0 allowed.
- **When the emergency fund is below the gate:** investing is 0 and the held-back amount goes to
  savings, so it feeds the emergency fund first. Decision and rationale: every source that gives an
  order puts the emergency fund before long-term investing (section 2.5), and the investor bulletin
  says without an emergency fund a small setback can turn into long-term debt. The gate is 3 months,
  the low end of the range. The user can turn the gate off, and the UI says what that changes.
- The Smart Plan outputs an amount only. It names no instrument and gives no buy or sell signal.
  The monthly split of the investing amount across instruments is a separate feature (PLAN 6.6).

### 3.6 Routing the savings share

Input: savings amount `S`, the goals list, `efTarget`, `efSaved`, `today`.

1. **Emergency fund first.** `efNeed = max(0, efTarget - efSaved)`; `toEf = min(S, efNeed)`.
   `left = S - toEf`.
2. **Other goals.** Take active (not archived) non-emergency goals with `remaining = targetMinor -
   saved > 0`. Sort by `priority` ascending (1 = highest), then by deadline ascending (no deadline
   last), then by creation order.
3. **Claim per goal.**
   - With a deadline: `monthsLeft = max(1, whole calendar months from today's month to the
     deadline's month)` (same rule as PLAN 6.3), `claim = ceil(remaining / monthsLeft)`.
   - A past deadline (deadline month earlier than the current month) gives `monthsLeft = 1`, so
     `claim = remaining`, and the goal is flagged `deadline_passed`. A deadline in the current month
     also gives `monthsLeft = 1` but is not flagged as passed.
   - No deadline: `claim = remaining`.
4. **Pass 1.** In sorted order, `alloc = min(claim, left)`; `left -= alloc`.
5. **Pass 2.** If `left > 0`, give goals in the same order `min(remaining - alloc, left)`, so spare
   money pays goals off sooner.
6. **Uncommitted.** Anything still left is `uncommittedSavings`. It stays in the savings account
   and is shown as "not assigned to a goal".
7. **Flags.** For every deadline goal where `alloc < claim`: `deadline_at_risk`, showing the claim
   (the required monthly amount), the allocation, and the gap.

Deadlines never jump the emergency fund; the user's priority number decides among other goals.
Rationale: the brief says "emergency fund first" and the sources agree. If a deadline goal is at
risk, the UI lists the ways to fix it: change the percentages, move the deadline or the priority.

### 3.7 Surplus: income above the baseline

For the current month `m` (after the monthly split above has been applied to goal balances):
- `received = max(0, sum of done income transactions of all three types in m)`.
- `X = max(0, received - B)`. If `received < B`, `X = 0` and the UI shows the shortfall
  `B - received` (use the buffer; the plan is not recomputed in the month).

Order of priority for `X`:
1. **Tax reserve.** `t = min(X, taxReserveDue)`, where `taxReserveDue` is the estimate from the tax
   module for income received in `m` (labelled estimate). Rationale: MoneyHelper says self-employed
   people must set money aside for tax. If the tax module has no figure, `t = 0`.
2. **Free spending.** `d = floor((X - t) x surplusDiscretionaryBp / 10000)`. Default 10 %. It may be
   0. Rationale: MoneyHelper says to avoid just spending extra cash, so most goes to savings, but a
   small share keeps the system livable. Decision, not sourced.
3. **Emergency fund** until `efTarget` (counting this month's planned contribution).
4. **Other goals** by the rule in 3.6 (pass 1 then pass 2), also counting this month's planned
   contribution.
5. **Investing**, only if `investingBp > 0` and the gate is open after steps 3 and 4.
   Amount: `min(left, Iw)`, where `Iw` is the monthly wanted investing amount. The cap stops a
   large invoice from turning into one big purchase. Decision.
6. **Uncommitted.** What remains stays as free cash/uncommitted savings.

The sum `t + d + toEf + goals + investing + uncommitted = X` exactly (integer arithmetic).
CFPB, Vanguard and JPMorgan all say to save more in high-income months; this is that rule.

### 3.8 Integer-cent rounding

- All inputs and outputs are safe integers in cents. No floating point is carried across steps.
- Percent to cents uses `floor(amount x bp / 10000)`. Savings (or `uncommitted` in the surplus rule)
  is always the balance, so the sum is exact by construction.
- Monthly equivalents use `roundHalfUp`; goal claims use `ceil` (never under-plan a deadline);
  averages use `roundHalfUp`.
- Displayed percentages (to 0.1 %) use the largest-remainder method on the final cents so the
  displayed figures add to exactly 100.0 %. Ties break by fixed order: essentials, discretionary,
  savings, investing.
- A property test (random inputs) must assert: parts >= 0 and sum = B for every input. I checked
  the steps of 3.4 in a scratch JavaScript model with 200 000 random inputs (including overrides and
  both gate states) and found no failures. The worked examples in section 4 were computed with the
  same model. The scratch code is not part of the repo, and the TypeScript below is not yet compiled.

### 3.9 Types and pseudo-code

```ts
type Cents = number;          // safe integer, euro cents
type Bp = number;             // integer 0..10000
type Month = string;          // 'YYYY-MM'
type LocalDate = string;      // 'YYYY-MM-DD', Europe/Athens

type Mode = 'normal' | 'squeeze' | 'deficit';
type Profile = 'fixed' | 'irregular';
type Confidence = 'none' | 'provisional' | 'partial' | 'full';

interface PlanSettings {
  baselineWindowMonths: number;        // 6
  essentialsWindowMonths: number;      // 3
  discretionaryBp: Bp;                 // 3000
  investingBp: Bp;                     // 1000
  minSavingsBp: Bp;                    // 500
  essentialsBpOverride: Bp | null;     // null
  efMonthsFixed: number;               // 3
  efMonthsIrregular: number;           // 6
  efMonthsOverride: number | null;     // null
  efGateMonths: number;                // 3
  investWhileEfUnfunded: boolean;      // false
  irregularShareBp: Bp;                // 2500
  profileOverride: Profile | null;     // null
  manualVariableBaselineMinor: Cents | null; // null
  surplusDiscretionaryBp: Bp;          // 1000
}

// ---------- 3.1 baseline ----------
interface BaselineInput {
  fixedMonthlyEquivalents: Cents[];             // one per active recurring_fixed source
  variableMonths: { month: Month; totalMinor: Cents }[]; // counted months, oldest first, <= window
  manualVariableBaselineMinor: Cents | null;
}
interface BaselineResult {
  fixedMinor: Cents;
  variableMinor: Cents;
  baselineMinor: Cents;                          // fixed + variable
  method: 'min' | 'manual' | 'none';
  monthsUsed: number;
  confidence: Confidence;
  medianMinor: Cents | null;                     // information only
  meanMinor: Cents | null;
}
function computeBaseline(i: BaselineInput): BaselineResult {
  const fixed = sum(i.fixedMonthlyEquivalents);
  const totals = i.variableMonths.map(m => Math.max(0, m.totalMinor));
  const n = totals.length;
  let variable = 0, method: BaselineResult['method'] = 'none';
  if (i.manualVariableBaselineMinor !== null) { variable = i.manualVariableBaselineMinor; method = 'manual'; }
  else if (n > 0) { variable = Math.min(...totals); method = 'min'; }
  const confidence = n === 0 ? 'none' : n < 3 ? 'provisional' : n < 6 ? 'partial' : 'full';
  return { fixedMinor: fixed, variableMinor: variable, baselineMinor: fixed + variable,
           method, monthsUsed: n, confidence,
           medianMinor: n ? median(totals) : null, meanMinor: n ? roundHalfUp(sum(totals) / n) : null };
}

// ---------- 3.2 essentials ----------
interface EssentialsInput {
  fixedEssentialMonthly: Cents[];                // active recurring_expenses in essential categories
  categories: { categoryId: string; monthTotals: Cents[]; budgetMonthlyMinor: Cents | null }[];
  // monthTotals: last <= 3 complete months, done expenses without recurringExpenseId, oldest first
}
function computeEssentials(i: EssentialsInput): { fixedMinor: Cents; variableMinor: Cents; totalMinor: Cents } {
  const fixed = sum(i.fixedEssentialMonthly);
  const variable = sum(i.categories.map(c => {
    const t = c.monthTotals.map(x => Math.max(0, x));
    const avg = t.length ? roundHalfUp(sum(t) / t.length) : 0;
    return Math.max(avg, c.budgetMonthlyMinor ?? 0);
  }));
  return { fixedMinor: fixed, variableMinor: variable, totalMinor: fixed + variable };
}

// ---------- 3.3 profile and emergency fund ----------
interface ProfileInput {
  receivedFixed6: Cents; receivedVariable6: Cents; receivedOneTime6: Cents; // last 6 complete months
  hasActiveFixedSource: boolean;
}
function incomeProfile(i: ProfileInput, s: PlanSettings): Profile {
  if (s.profileOverride) return s.profileOverride;
  const total = i.receivedFixed6 + i.receivedVariable6 + i.receivedOneTime6;
  if (total <= 0) return i.hasActiveFixedSource ? 'fixed' : 'irregular';
  const shareBp = Math.floor(((i.receivedVariable6 + i.receivedOneTime6) * 10000) / total);
  return shareBp >= s.irregularShareBp ? 'irregular' : 'fixed';
}
function emergencyFund(essentials: Cents, profile: Profile, goalTarget: Cents | null,
                       saved: Cents, s: PlanSettings) {
  const months = s.efMonthsOverride ?? (profile === 'irregular' ? s.efMonthsIrregular : s.efMonthsFixed);
  const formula = months * essentials;
  const target = goalTarget && goalTarget > 0 ? goalTarget : formula;
  const gate = Math.min(s.efGateMonths * essentials, target);
  return { months, formulaMinor: formula, targetMinor: target, savedMinor: saved,
           needMinor: Math.max(0, target - saved), gateMinor: gate };
}

// ---------- 3.4 split ----------
interface SplitInput {
  baselineMinor: Cents; essentialsMinor: Cents;
  efSavedMinor: Cents; efGateMinor: Cents;
  settings: PlanSettings;
}
interface Split {
  essentialsMinor: Cents; discretionaryMinor: Cents; savingsMinor: Cents; investingMinor: Cents;
  mode: Mode; shortfallMinor: Cents;     // essentials above baseline (deficit)
  gateOpen: boolean; investingHeldMinor: Cents;
  steps: { label: string; formula: string; valueMinor: Cents }[];  // shown in the UI
}
function splitBaseline(i: SplitInput): Split {
  const B = i.baselineMinor, s = i.settings;
  if (B <= 0) return zeroSplit(i.essentialsMinor);                  // step 1
  const bp = (x: Bp) => Math.floor((B * x) / 10000);
  const E = s.essentialsBpOverride !== null ? Math.min(bp(s.essentialsBpOverride), B)
                                            : Math.min(i.essentialsMinor, B);              // step 2
  const shortfall = s.essentialsBpOverride !== null ? 0 : i.essentialsMinor - E;
  const R = B - E;                                                                           // step 3
  const Dw = bp(s.discretionaryBp), Iw = bp(s.investingBp);                                  // step 4
  const run = (gateOpen: boolean) => {
    const Ie = gateOpen ? Iw : 0;                                                            // step 5
    const Sf = Math.min(R, bp(s.minSavingsBp));                                              // step 6
    if (R - Dw - Ie >= Sf) return { D: Dw, I: Ie, S: R - Dw - Ie, squeeze: false };          // step 7
    const rest = R - Sf;                                                                     // step 8
    const D = Math.min(Dw, rest), I = Math.min(Ie, rest - D);
    return { D, I, S: R - D - I, squeeze: true };
  };
  const gateOpen = s.investWhileEfUnfunded || i.efSavedMinor >= i.efGateMinor;
  const a = run(gateOpen), open = run(true);
  const deficit = s.essentialsBpOverride === null && i.essentialsMinor >= B;   // step 9
  const mode: Mode = deficit ? 'deficit' : a.squeeze ? 'squeeze' : 'normal';
  return { essentialsMinor: E, discretionaryMinor: a.D, savingsMinor: a.S, investingMinor: a.I,
           mode, shortfallMinor: shortfall, gateOpen,
           investingHeldMinor: Math.max(0, a.S - open.S), steps: [/* built from the values above */] };
}
// invariant: E + D + S + I === B, all parts >= 0

// ---------- 3.6 savings routing ----------
interface Goal { id: string; name: string; targetMinor: Cents; savedMinor: Cents;
                 deadline: Month | null; priority: number; isEmergencyFund: boolean; createdSeq: number; }
interface GoalAllocation { goalId: string; allocMinor: Cents; claimMinor: Cents;
                           flags: ('deadline_at_risk' | 'deadline_passed' | 'funded')[]; }
interface Routing { efMinor: Cents; goals: GoalAllocation[]; uncommittedMinor: Cents; }
function routeSavings(S: Cents, goals: Goal[], ef: { needMinor: Cents }, todayMonth: Month): Routing {
  const toEf = Math.min(S, ef.needMinor);
  let left = S - toEf;
  const open = goals.filter(g => !g.isEmergencyFund && g.targetMinor - g.savedMinor > 0)
                    .sort(byPriorityThenDeadlineThenSeq);
  const rows = open.map(g => {
    const remaining = g.targetMinor - g.savedMinor;
    const m = g.deadline ? Math.max(1, monthsBetween(todayMonth, g.deadline)) : 1;
    const claim = g.deadline ? Math.ceil(remaining / m) : remaining;
    const passed = g.deadline !== null && monthsBetween(todayMonth, g.deadline) < 0;
    return { g, remaining, claim, alloc: 0, passed };
  });
  for (const r of rows) { r.alloc = Math.min(r.claim, left); left -= r.alloc; }              // pass 1
  for (const r of rows) { const x = Math.min(r.remaining - r.alloc, left); r.alloc += x; left -= x; } // pass 2
  return { efMinor: toEf, uncommittedMinor: left,
           goals: rows.map(r => ({ goalId: r.g.id, allocMinor: r.alloc, claimMinor: r.claim,
             flags: [ ...(r.g.deadline && r.alloc < r.claim ? ['deadline_at_risk' as const] : []),
                      ...(r.passed ? ['deadline_passed' as const] : []) ] })) };
}

// ---------- 3.7 surplus ----------
interface SurplusInput {
  receivedMinor: Cents; baselineMinor: Cents; taxReserveDueMinor: Cents;
  routingState: { efNeedMinor: Cents; goals: Goal[] };  // after this month's planned contributions
  gateOpenAfterEf: boolean; investingWantedMinor: Cents; settings: PlanSettings; todayMonth: Month;
}
interface Surplus { surplusMinor: Cents; shortfallMinor: Cents; taxReserveMinor: Cents;
                    discretionaryMinor: Cents; efMinor: Cents; goals: GoalAllocation[];
                    investingMinor: Cents; uncommittedMinor: Cents; }
function routeSurplus(i: SurplusInput): Surplus {
  const X = Math.max(0, i.receivedMinor - i.baselineMinor);
  const shortfall = Math.max(0, i.baselineMinor - i.receivedMinor);
  const t = Math.min(X, i.taxReserveDueMinor);
  const d = Math.floor(((X - t) * i.settings.surplusDiscretionaryBp) / 10000);
  const r = routeSavings(X - t - d, i.routingState.goals, { needMinor: i.routingState.efNeedMinor }, i.todayMonth);
  const inv = i.settings.investingBp > 0 && i.gateOpenAfterEf
            ? Math.min(r.uncommittedMinor, i.investingWantedMinor) : 0;
  return { surplusMinor: X, shortfallMinor: shortfall, taxReserveMinor: t, discretionaryMinor: d,
           efMinor: r.efMinor, goals: r.goals, investingMinor: inv,
           uncommittedMinor: r.uncommittedMinor - inv };
}
```

**Top-level function.** `buildPlan(input, today): Plan` calls `computeBaseline`, `computeEssentials`,
`incomeProfile`, `emergencyFund`, `splitBaseline`, `routeSavings` and (for the current month)
`routeSurplus`, and returns every intermediate value in `Plan.steps` so the UI can show the formula
and the numbers (section 6).

## 4. Worked examples

Today is 2026-10-22 in every example, so the current month is 2026-10 and the baseline window is
2026-04 to 2026-09. Amounts are in euros, computed from integer cents (the cents value is in
brackets where it helps). Defaults from 3.0 apply unless stated. All numbers are illustrative inputs,
not typical Greek figures. The split numbers were computed with a scratch JavaScript model of
section 3.4 (section 3.8).

### Example 1: salary only

**Inputs**
- One `recurring_fixed` source: net salary 1,800.00 (180 000 cents). No variable income, no one-time.
- Essentials: fixed 640.00 (rent 450, utilities 120, phone and internet 40, insurance 30). Variable
  essentials: groceries last 3 months 270.00, 255.00, 265.00 (mean 263.33) with a budget of 280.00,
  so `max` = 280.00; transport 60.00, 55.00, 65.00 (mean 60.00, no budget); health 20.00, 0.00,
  40.00 (mean 20.00).
- Emergency-fund goal: saved 200.00 (target not set by the user). Goal "Holiday": target 900.00,
  saved 0, deadline 2027-06, priority 1.

**Steps**
1. B = F + V = 1,800.00 + 0 = **1,800.00**.
2. Evar = 280.00 + 60.00 + 20.00 = 360.00. E = 640.00 + 360.00 = **1,000.00** (55.6 % of B).
3. Profile: all income is fixed, share 0 %, so `fixed`. efMonths = 3, target = 3 x 1,000.00 =
   3,000.00. Saved 200.00, need 2,800.00. Gate = min(3 x 1,000.00, 3,000.00) = 3,000.00. 200.00 is
   below it, so the gate is closed.
4. R = 1,800.00 - 1,000.00 = 800.00. Dw = floor(180 000 x 3000 / 10 000) = 540.00.
   Iw = 180.00, but the gate is closed, so Ie = 0. Sf = 90.00 (5 %).
5. Normal-mode test: R - Dw - Ie = 800 - 540 - 0 = 260.00 >= Sf (90.00). Normal mode.
   D = 540.00, I = 0, S = 800 - 540 - 0 = 260.00.
6. Investing held back = S(gate closed) - S(gate open) = 260.00 - 90.00 = 170.00. With the gate open,
   squeeze mode would apply: rest = 710.00, D = 540.00, I = min(180, 170) = 170.00, S = 90.00.

**Savings routing (S = 260.00).** Emergency fund takes min(260.00, 2,800.00) = 260.00. Holiday:
monthsLeft = 2026-10 to 2027-06 = 8, claim = ceil(900.00 / 8) = 112.50, allocation 0.00, so
`deadline_at_risk` (gap 112.50). At this pace the emergency fund needs ceil(2,800 / 260) = 11 months,
which is after the Holiday deadline. The UI says so and offers the fixes (3.6).

| Part | Amount | Share of B |
|------|-------:|-----------:|
| Essentials | 1,000.00 | 55.6 % |
| Discretionary | 540.00 | 30.0 % |
| Savings | 260.00 | 14.4 % |
| Investing | 0.00 | 0.0 % |
| **Total** | **1,800.00** | **100.0 %** |

**Variant 1b: emergency fund already funded (saved 3,200.00, target 3,000.00).**
Need = 0, gate open. Ie = 180.00. Normal test: 800 - 540 - 180 = 80.00 < Sf (90.00), so squeeze:
rest = 800 - 90 = 710.00, D = min(540, 710) = 540.00, I = min(180, 710 - 540) = 170.00,
S = 800 - 540 - 170 = 90.00. Parts: 1,000.00 + 540.00 + 90.00 + 170.00 = 1,800.00. Shares 55.6 / 30.0 /
5.0 / 9.4 = 100.0 %. Routing: emergency fund 0; Holiday claim 112.50, allocation 90.00,
`deadline_at_risk` (gap 22.50).

### Example 2: part-time salary plus εργόσημο

**Inputs**
- `recurring_fixed`: part-time net salary 900.00. `recurring_variable`: εργόσημο, net amounts
  received in the 6 complete months: Apr 410.00, May 620.00, Jun 280.00, Jul 350.00, Aug 180.00,
  Sep 520.00. Total 2,360.00.
- Essentials E = 760.00 (fixed 520.00: rent 400, utilities 80, phone 40; variable 240.00:
  groceries mean 220.00, transport mean 20.00).
- Emergency fund saved 600.00, no user target.
- This month (2026-10) received: salary 900.00 + εργόσημο 700.00. Tax module reserve due: 0.00.

**Steps**
1. V = min(410, 620, 280, 350, 180, 520) = **180.00** (Aug), confidence `full` (6 months).
   Median = 380.00, mean = 393.33 (information; the gap V vs median = 200.00).
   B = 900.00 + 180.00 = **1,080.00**.
2. E = **760.00** (70.4 % of B).
3. Profile: received in 6 months: fixed 5,400.00, variable 2,360.00, one-time 0. Share =
   2,360 / 7,760 = 30.4 % >= 25 %, so `irregular`. efMonths = 6, target = 4,560.00, saved 600.00,
   need 3,960.00. Gate = min(3 x 760.00, 4,560.00) = 2,280.00. Closed.
4. R = 1,080 - 760 = 320.00. Dw = 324.00, Iw = 108.00 (Ie = 0). Sf = 54.00.
5. Normal test: 320 - 324 - 0 = -4.00 < 54.00. Squeeze: rest = 320 - 54 = 266.00, D = min(324, 266) =
   266.00, I = 0, S = 320 - 266 = 54.00.

**Savings routing (S = 54.00):** all to the emergency fund (need 3,960.00).

| Part | Amount | Share of B |
|------|-------:|-----------:|
| Essentials | 760.00 | 70.4 % |
| Discretionary | 266.00 | 24.6 % |
| Savings | 54.00 | 5.0 % |
| Investing | 0.00 | 0.0 % |
| **Total** | **1,080.00** | **100.0 %** |

**Surplus this month.** received = 1,600.00, X = 1,600 - 1,080 = 520.00. Tax reserve t = 0.
Free spending d = floor(520.00 x 10 %) = 52.00. Remaining 468.00 goes to the emergency fund (need
after this month's plan: 3,960 - 54 = 3,906.00). Check: 52.00 + 468.00 = 520.00.

### Example 3: irregular-only income with low months

**Inputs**
- Only `recurring_variable` income. Net by month: Apr 1,640.00, May 1,220.00, Jun 1,900.00,
  Jul 1,080.00, Aug 1,400.00, Sep 1,320.00. No salary.
- Essentials E = 610.00 (fixed 380.00: rent 280, utilities 70, phone and internet 30; variable
  230.00: groceries mean 200.00, transport mean 30.00).
- Emergency fund: none saved. No other goals.
- This month: variable pay 1,500.00 and a one-time invoice, net 1,000.00. Tax module (estimate)
  says reserve 150.00 is due on this income. This 150.00 is an illustrative input, not a tax rate.

**Steps**
1. V = min = **1,080.00** (Jul). Median = (1,320 + 1,400) / 2 = 1,360.00. B = **1,080.00**.
   (With a median baseline of 1,360.00, July would have fallen 280.00 short, which is 20.6 % of that
   baseline.)
2. E = **610.00** (56.5 % of B).
3. Profile `irregular` (share 100 %). efMonths = 6, target = 3,660.00, saved 0, need 3,660.00. Gate
   = min(1,830.00, 3,660.00) = 1,830.00. Closed.
4. R = 1,080 - 610 = 470.00. Dw = 324.00, Iw = 108.00 (Ie = 0). Sf = 54.00.
5. Normal test: 470 - 324 - 0 = 146.00 >= 54.00. Normal. D = 324.00, I = 0, S = 146.00.
   Investing held back: with the gate open S would be 54.00 (squeeze), so held = 146 - 54 = 92.00.

| Part | Amount | Share of B |
|------|-------:|-----------:|
| Essentials | 610.00 | 56.5 % |
| Discretionary | 324.00 | 30.0 % |
| Savings | 146.00 | 13.5 % |
| Investing | 0.00 | 0.0 % |
| **Total** | **1,080.00** | **100.0 %** |

**Savings routing:** 146.00 to the emergency fund. At 146.00 a month the fund needs 26 months
(ceil(3,660 / 146)), which is why the surplus rule matters here.

**Surplus this month.** received = 1,500 + 1,000 = 2,500.00, X = 2,500 - 1,080 = 1,420.00.
- Tax reserve t = min(1,420, 150.00) = 150.00.
- Free spending d = floor((1,420 - 150) x 10 %) = 127.00.
- Remaining 1,143.00 to the emergency fund (need after the plan: 3,660 - 146 = 3,514.00).
- Check: 150.00 + 127.00 + 1,143.00 = 1,420.00.

### Example 4: essentials exceed the baseline

**4a. Deficit.** Net salary 700.00 is the only income, B = 700.00. Essentials: fixed 520.00 plus
variable 330.00 = 850.00. Steps: E >= B, so Es = 700.00, shortfall = 150.00, R = 0, D = I = S = 0.
Mode `deficit`. Result: essentials 700.00 (100.0 %), discretionary 0.00, savings 0.00, investing 0.00,
total 700.00 (100.0 %). The UI says: "Your essentials (850.00) are 150.00 above your baseline
(700.00). Review fixed costs or income." No emergency-fund routing happens (S = 0). The profile is
`fixed` (3 months), target 2,550.00, shown as a goal but not funded by the plan.

**4b. Squeeze (essentials just below the baseline).** Same salary B = 700.00, essentials 640.00
(fixed 460.00 plus variable 180.00). R = 60.00. Dw = 210.00, Ie = 0 (gate closed), Sf = 35.00.
Normal test: 60 - 210 < 35, so squeeze: rest = 60 - 35 = 25.00, D = min(210, 25) = 25.00, I = 0,
S = 60 - 25 = 35.00.

| Part | Amount | Share of B |
|------|-------:|-----------:|
| Essentials | 640.00 | 91.4 % |
| Discretionary | 25.00 | 3.6 % |
| Savings | 35.00 | 5.0 % |
| Investing | 0.00 | 0.0 % |
| **Total** | **700.00** | **100.0 %** |

The UI warns that essentials are 91.4 % of the baseline.

## 5. Edge cases

Each row is a required unit test. "Result" is the specified behaviour.

| Case | Result |
|------|--------|
| **No history at all** (new user, no transactions) | `V = 0`, confidence `none`. `B = F`. Essentials: fixed recurring essentials plus budgets only (no averages). If there is no fixed source either, `B = 0` and the plan shows zeros with the message "Add income to see a plan". The UI offers a manual variable baseline. |
| **Fewer than 6 months of variable history** | `n` months are used with the same minimum rule. Confidence `provisional` (1 to 2 months) or `partial` (3 to 5). The UI shows the badge and "based on n months". |
| **A zero-income month inside the window** | Counts as 0 and so sets `V = 0`, if the source was active that month. The UI says "Your lowest month had no income, so the variable baseline is 0. Enter a manual baseline if this month was exceptional." Months before the first received entry, and months when no variable source was active, are not counted. |
| **Negative or refunded amounts** | A refund is a negative income amount. The month total is the signed sum, clamped at 0 (`max(0, sum)`). Expense refunds reduce the category month total, also clamped at 0. A refund never creates negative parts in the split. |
| **Expected (not yet received) income** | Ignored for V, the profile and the surplus. Fixed salaries are planned from `expectedNetMinor` regardless of status. |
| **Goal with a past deadline** | `monthsLeft = 1`, `claim = remaining`, flag `deadline_passed`. The UI proposes a new deadline. A deadline in the current month is not "past". |
| **Goal with no deadline** | `claim = remaining`. It is served in priority order and takes whatever is left. |
| **Goal already funded** (`saved >= target`) | Excluded from routing; shown as `funded`. |
| **Emergency fund already funded** (`saved >= target`) | `efNeed = 0`, the gate is open (gate is `<= target`), all savings go to other goals. If there are none, `uncommittedMinor = S`. The UI says "Emergency fund target reached" and suggests reviewing the target if essentials changed. |
| **No emergency-fund goal exists** | `efSaved = 0`, the plan shows the target and a "Create emergency fund" action. Until it exists, the savings amount cannot be recorded against it, but the split is still computed. |
| **Emergency-fund goal target below the formula** | The goal target wins (`efTarget`), the formula is shown as a suggestion. |
| **Essentials change after the fund was built** | Target and gate are recomputed from the new E every time. The fund can move from funded to unfunded. The UI shows the change. |
| **Essentials exceed the baseline** | Deficit mode (example 4a). Shortfall shown. |
| **Essentials fill most of the baseline** | Squeeze mode (example 4b). |
| **Baseline is 0 but essentials > 0** | Zero split, `shortfall = E`. |
| **All percentages overridden to 0** | `essentialsBpOverride = 0`, `discretionaryBp = 0`, `investingBp = 0`: essentials 0, discretionary 0, investing 0, savings = B. The UI warns "essentials set to 0 %". The gate redirect is zero and has no effect. |
| **Overrides add up to more than 100 %** | Squeeze logic applies in the order essentials, savings floor, discretionary, investing. The UI shows "scaled down to fit 100 %". |
| **Investing 0 %** | `I = 0`. The surplus rule also skips investing. |
| **Gate turned off** (`investWhileEfUnfunded = true`) | `Ie = Iw` even if the fund is empty. The UI shows "Investing before the emergency fund is full". |
| **One-time income only (freelance), no recurring** | `B = 0`. The monthly plan is empty. The surplus rule treats the whole received amount as surplus: tax reserve first, then the free-spending share, then the emergency fund, goals, investing. This is the right behaviour for the "budget only money received" idea. |
| **Received below baseline** | `X = 0`, shortfall shown. The plan is not recomputed mid-month. |
| **Tax module has no figure** | `taxReserveDue = 0`. The UI notes that no tax estimate was available. |
| **Dates and months** | All month boundaries use Europe/Athens local dates (`month` field). The current month is never in a window. A DST change does not affect month sums because the app groups by stored `localDate`. |
| **Rounding** | Floor for percent-to-cents, ceil for goal claims, half-up for averages and monthly equivalents. Parts sum to B exactly. Displayed percentages use the largest-remainder method so they add to 100.0 %. Example: 1/3 of 100 cents each gives 33, 33, 33 and the last cent goes to the balance part (savings). |
| **Very small baseline** (for example 1 cent) | Floors give 0 for D and I, and savings (the balance) takes the remainder. Parts still sum to B. |
| **Currency** | EUR only. Another currency in a transaction is converted to EUR before the plan sees it (outside this module). |

## 6. What the UI must show

The `/plan` page (PLAN section 5) must show all of the following. The `Plan.steps` array returned by
`buildPlan` carries one entry per line below: a label, a formula string, the input values and the
result in cents.

1. **Disclaimer, always visible next to the result and in any exported or notified summary:**
   > Educational, not financial advice. This plan applies general rules of thumb to the numbers you
   > entered. It is an estimate, not a prediction, and not a recommendation to buy or sell anything.
2. **Baseline block.**
   - Formula: `Baseline = fixed income + variable baseline`.
   - Inputs: each `recurring_fixed` source with its monthly equivalent; the months used for the
     variable baseline (a small table, lowest month marked); the method (`lowest month`, `manual`);
     the confidence badge; the median and the mean as information; the note that one-time income is
     excluded and is handled as surplus.
3. **Essentials block.** Formula `Essentials = fixed essential costs + max(3-month average, budget)
   per essential category`. Inputs: the list of fixed items and the category rows (average, budget,
   value used).
4. **Split block.** The four parts in cents and percent of the baseline (percentages add to 100.0 %),
   the mode (`normal`, `squeeze`, `deficit`) in plain words, the default percentage next to each
   user override, the order of operations (3.4) with the numbers filled in, and the held-back
   investing amount when the gate is closed ("Investing starts when your emergency fund reaches
   N months of essentials").
5. **Emergency-fund block.** Profile (`fixed` or `irregular`) with the reason (share of variable and
   one-time income in the last 6 months), months used (3 or 6), target = months x essentials,
   saved, remaining, and the number of months to fund at the current savings amount. Wording: "rule of
   thumb of 3 to 6 months of essentials; the right amount depends on your situation."
6. **Goals block.** For each goal: priority, remaining, deadline, required monthly amount, allocation
   this month and flags (`deadline_at_risk`, `deadline_passed`, `funded`) with the ways to fix them.
7. **Surplus block (current month).** Received, baseline, surplus or shortfall, and the five-step
   routing with amounts (tax reserve labelled "estimate").
8. **Override controls.** Essentials, discretionary and investing percentages (savings is the balance
   and is shown as derived), emergency-fund months, gate on/off, manual variable baseline, profile.
   A "reset to defaults" button. The sum is always 100 %.
9. **Sources used.** An expandable "Why these rules" list with the sources in section 7 that apply to
   the shown blocks, and a plain statement of which parameters are design decisions, not sourced
   (the list in section 8).
10. **Warnings in plain words:** low confidence baseline, zero-income month in the window, deficit,
    squeeze, deadline at risk, goal deadline passed, high-interest debt hint (text only), no
    emergency-fund goal.
11. **No signals.** The plan never names an instrument, never says "buy" or "sell", and never
    predicts returns.

Tests for the UI contract: the formula string and the inputs for each block exist for every example
in section 4, and the disclaimer text is rendered whenever a plan is rendered.

## 7. Sources

All opened on 2026-10-22 and read in this task.

1. CFPB, "An essential guide to building an emergency fund".
   https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/ (read 2026-10-22).
   Used for: no fixed amount; pay yourself first; automatic saving; where to keep it; save in weeks with more money.
2. MoneyHelper (UK), "Emergency savings - how much is enough?".
   https://www.moneyhelper.org.uk/en/savings/types-of-savings/emergency-savings-how-much-is-enough (read 2026-10-22).
   Used for: 3 to 6 months of essentials, instant access, priority debts first, continue to other goals after the target.
   (Opened with the Playwright browser, because plain fetch returned HTTP 403.)
3. MoneyHelper (UK), "How to budget for an irregular income".
   https://www.moneyhelper.org.uk/en/everyday-money/budgeting/how-to-budget-for-an-irregular-income (read 2026-10-22).
   Used for: budget for the lowest month, list essential outgoings, set aside tax, build an emergency fund (3 months, at least 1 month of income helps).
4. JPMorgan Chase Institute, "Weathering Volatility 2.0: A Monthly Stress Test to Guide Savings" (October 2019).
   https://www.jpmorganchase.com/institute/all-topics/financial-health-wealth-creation/report-weathering-volatility-2-a-monthly-stress-test-to-guide-saving (read 2026-10-22).
   Used for: income volatility evidence (US, Chase customers), six-week buffer, save more in spike months.
5. Simon & Schuster, *All Your Worth* publisher page.
   https://www.simonandschuster.com/books/All-Your-Worth/Elizabeth-Warren/9780743269889 (read 2026-10-22).
   Used for: the three-part framework in the authors' words. The page has no percentages.
6. Get Rich Slowly, review of *All Your Worth* (secondary source).
   https://www.getrichslowly.org/book-review-all-your-worth/ (read 2026-10-22).
   Used for: 50/30/20 percentages and the savings sequence, as the reviewer reports them. `[uncertain]`.
7. Investor bulletin "Investor Resilience - World Investor Week 2022", CFTC copy.
   https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/keytopicsforworldinvestorweek2022 (read 2026-10-22).
   Used for: emergency fund as first resilience tip, 3 to 6 months, bank or credit union, save automatically.
8. Vanguard, "What's the right emergency savings amount?".
   https://ownyourfuture.vanguard.com/content/en/learn/financial-planning/whats-the-right-emergency-savings-amount.html (read 2026-10-22).
   Used for: spending shock versus income shock amounts, larger fund when income is not steady, where to keep it.
9. Vanguard, "Key insights on income volatility and emergency savings".
   https://investor.vanguard.com/investor-resources-education/article/understanding-income-volatility-and-emergency-saving (read 2026-10-22).
   Used for: income variability as a main factor, contribute more in high-earning periods.
10. FINRA, emergency fund page (Financial Foundations series).
    https://www.finra.org/investors/insights/start-emergency-fund (read 2026-10-22).
    Used for: 3 to 6 months, larger reserve for variable income, liquid account, debt versus fund balance, start the habit.
11. FINRA, "Manage your debt".
    https://www.finra.org/investors/personal-finance/manage-your-debt (read 2026-10-22).
    Used for: paying off high-interest debt can beat investment returns.
12. CFPB Building Blocks teacher guide, "Tracking income" (Summer 2022), copy hosted by FHI 360.
    https://fhi360.org/sites/default/files/media/documents/cfpb_building_block_activities_tracking-income_guide.pdf (read 2026-10-22).
    Used for: regular versus irregular income, save in months with more money. (The CFPB URL
    redirected to this copy.)
13. CFPB Your Money, Your Goals, "Income and benefits tracker".
    https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_income_benefits_tool_2018-11_ADA.pdf (read 2026-10-22).
    Used for: labelling income as regular, irregular, seasonal and one-time-only.
14. Eurostat, "Living conditions in Europe - housing" (Statistics Explained, data extracted November 2025).
    https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/67027.pdf (read 2026-10-22).
    Used for: housing cost overburden 2024 (EU 8.2 %, Greece 28.9 %).
15. YNAB, "The YNAB method" page.
    https://www.ynab.com/ynab-four-rules-budgeting (read 2026-10-22).
    Used for: "For Later" (set aside monthly amounts for irregular expenses) only.
16. Greek Ministry of Labour circular 14913/343/Φ10034/27.6.2011 on the εργόσημο, text on taxheaven.gr.
    https://www.taxheaven.gr/circulars/12366 (read 2026-10-22).
    Used for: what the εργόσημο is (voucher, partial withholding for contributions). Not an
    official portal; 2011 text, later changes not checked. `[uncertain]`.

**Opened but not used for any claim:** Federal Reserve SHED emergency-savings page
(https://www.federalreserve.gov/consumerscommunities/sheddataviz/emergency-savings.html): the page
text contains no figures.

**Tried and failed (not cited):** investor.gov bulletin and glossary pages (HTTP 403); Simon &
Schuster UK page (403); the OECD/EC Financial Competence Framework page (403); a first MoneyHelper
URL (404). The CFP Board page named in the brief was not opened in this task.

## 8. [uncertain] list

Sourcing gaps (claims I could not confirm from a page I opened):
1. **50/30/20 percentages and the Warren and Tyagi savings sequence** come from a review, not the
   book or the publisher page. The book's year (commonly 2005) is not on the pages I read.
2. **"6 months for irregular income"**: no source gives a number of months for irregular income.
   Vanguard and FINRA only say "larger". Six is a decision at the top of the 3 to 6 range.
3. **Greek income volatility**: no Greek statistic found. The JPMorgan figures are US, Chase customers.
4. **εργόσημο rules**: only the 2011 circular, on a private legal-news site. Current withholding
   rates and later amendments are not checked. The app only needs the net amount the user receives.
5. **The investor.gov bulletin** was read through the CFTC copy; who issued it was not confirmed on the page.
6. **EC/OECD Financial Competence Framework and CFP Board**: not opened, so nothing is cited from them.

Design decisions with no source for the exact number (the sources support the direction only):
7. Variable baseline = minimum of the last 6 complete months (direction: MoneyHelper "lowest month").
8. Behaviour with fewer than 6 months and with zero months (provisional/none badges, V = 0 for none).
9. Treating a zero-income month as a real 0.
10. Essentials variable window of 3 months and the `max(average, budget)` rule.
11. Irregular profile threshold of 25 % (variable plus one-time share of the last 6 months).
12. Default percentages: discretionary 30 %, investing 10 %, savings floor 5 %, surplus free-spending 10 %.
13. Investing gate at 3 months of essentials and investing sitting last in the squeeze order.
14. Emergency fund taking the whole savings share until funded (no cap for deadlines).
15. Surplus order: tax reserve, free spending, emergency fund, goals, investing, uncommitted.
16. Cap of the surplus investing amount at the monthly wanted investing amount.

Not verified by running code: the TypeScript in 3.9 is pseudo-code. Only the split logic of 3.4 and
the example numbers were run in a scratch model.
