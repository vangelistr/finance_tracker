# Extras (not built)

Ideas beyond the brief, ranked by value for the owner against effort in this codebase. None of them is built.
Value: how much it helps the daily and monthly jobs in `PRODUCT.md`. Effort: S (a day or less), M (a few days),
L (a week or more). Every item keeps the project rules: no third party sees user data, money in integer cents.

| Rank | Extra | Value | Effort | Why this rank |
|---|---|---|---|---|
| 1 | JSON export (all of a user's data) | High | S | Ownership and portability with no new attack surface; the backups are server-wide, an export is per user. One read-only endpoint over the existing collections, filtered by `userId`. |
| 2 | Search and filters across transactions (text, amount range, account) | High | S | The ledger grows every day; finding "that payment in March" is a frequent need. A Mongo text index plus the existing list API. |
| 3 | Undo for delete and confirm (short-lived, in-app) | Medium-high | S | Mistaps on a phone are likely with 44 px rows; a 10-second undo toast avoids a re-entry. Soft delete with a TTL. |
| 4 | Emergency-fund runway (months covered at current essentials) | Medium-high | S | The Smart Plan already computes essentials and the fund; one figure and a sentence on the goals page. |
| 5 | CSV import of bank statements with categorisation rules | High | M | Removes manual entry for card spending; rules ("contains SKLAVENITIS → Groceries") learned from corrections. Parsing per bank format and de-duplication against quick-add entries are the work. Files stay on the server. |
| 6 | Tags (free-form, many per transaction) | Medium | S | Cross-cutting views (a trip, a project) without changing categories; filters and a donut by tag reuse the chart code. |
| 7 | Split transactions (one payment, several categories) | Medium | M | Supermarket receipts mixing groceries and household goods; affects every aggregate, budget and report, so it needs care. |
| 8 | Portfolio tracker (holdings, cost basis, P&L) | Medium | L | Natural next step for the investing module, but it holds financial positions and needs corporate-action handling; keep educational labelling. |
| 9 | What-if simulator for the Smart Plan (change income or a goal date and see the split) | Medium | M | Pure functions exist; a scratch input set and a side-by-side view. |
| 10 | Invoice entry with VAT and client withholding per invoice | Medium | M | The tax estimator now treats each freelance receipt as an invoice net of VAT; storing the invoice's VAT and withheld amounts would sharpen the estimate and the cash view. |
| 11 | Multi-currency accounts with FX conversion | Low-medium | M | Useful only if foreign-currency accounts appear; the FX feed exists in the investing module. |
| 12 | AADE myDATA import of issued invoices | Medium | L | Would remove double entry for freelancers, but it needs the user's AADE credentials and an external call carrying financial data, which conflicts with the privacy rule unless run entirely by the owner. [uncertain] API terms not reviewed. |

Not proposed: bank connections through aggregators (a third party would see the data), cloud sync, analytics.
