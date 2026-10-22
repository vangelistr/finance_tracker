# Greek tax and EFKA research for the Finance Tracker estimator

## 0. Header

**Purpose.** Facts, formulas and a versioned config for the app's estimator. It answers: how much of each freelance invoice to set aside for VAT, income tax and EFKA, for tax years 2025 and 2026 (Greece, EUR, Europe/Athens).

**Read date.** All sources below were opened on 2026-10-22 (today). Each citation `[S#]` points to the source register at the end of this section; every register row is "read 2026-10-22".

**Disclaimer (show in the app next to every figure).** Estimate, not tax advice; confirm with an accountant.

**Source rule.** Only official sources are cited (aade.gr, minfin.gov.gr, e-efka.gov.gr, ΦΕΚ PDFs hosted on aade.gr). Secondary sites were used only to find which official document to open. Anything I could not confirm from an official page I opened is tagged **[uncertain]**.

**How to use this file.**
- Sections 1 to 6 are the facts. Section 7 is the algorithm. Section 8 is a checked worked example. Section 9 is the JSON config (one block per tax year). Section 10 lists every [uncertain] item.
- Money in the algorithm and JSON is integer euro cents. Rates are basis points (bps; 100 bps = 1%).
- Where a rule is "per tax year", it belongs in the versioned config, not in code.
- Tag meaning: a fact with a citation was read in the cited page. A fact without `[S#]` is my inference and is marked as such.

**Important corrections to the earlier hypothesis.**
- The 2026 income-tax scale 9/20/26/34/39/44 % is now CONFIRMED in the law text (ΦΕΚ Α΄ 198/11.11.2025, law 5246/2025, art. 3) [S1]. The 2025 scale is the old 9/22/28/36/44 % [S2, S3].
- The prepayment (προκαταβολή) is 55% of the tax from business income; for individuals the reduction is **only for the first time business income is declared (50%)**, not "N years" [S3, S5, S2]. The "3-year" rules are about the first tax bracket (section 1.5) and the minimum presumed income (section 1.6).
- Self-employed EFKA: the "new professional" special class lasts the first **five** years of insurance [S13].

**Source register (all read 2026-10-22).**

| ID | Document | URL |
|---|---|---|
| S1 | Law 5246/2025, ΦΕΚ Α΄ 198/11.11.2025 (tax reform for demography and the middle class) | https://www.aade.gr/sites/default/files/2025-11/%CE%91%CE%A0%CE%9F%CE%A3%CE%A0%CE%91%CE%A3%CE%9C%CE%91%20%CE%A6%CE%95%CE%9A%20%CE%91%20198_2025%20%CE%9D%205246_2025.pdf |
| S2 | AADE Q&A manual on tax matters, May 2026 (tax year 2025 incomes) | https://www.aade.gr/sites/default/files/2026-05/egxeiridio_erotiseon_apantiseon_forologias_may_2026.pdf |
| S3 | AADE instructions for form E1, tax year 2025 (16 March 2026) | https://www.aade.gr/sites/default/files/2026-03/Odigies_E1_2026_0.pdf |
| S4 | AADE instructions for form E3, tax year 2025 (13 March 2026) | https://www.aade.gr/sites/default/files/2026-03/odigies_E3_FE_2025.pdf |
| S5 | Income Tax Code (ν. 4172/2013), administrative codification published by the Ministry of Finance, May 2024 (arts 16, 22, 28A, 29, 43A, 61, 62, 64, 69, 70) | https://minfin.gov.gr/wp-content/uploads/2024/05/%CE%A195%CE%A6%CE%97-59%CE%93_%CE%94%CE%B9%CE%BF%CE%B9%CE%BA%CE%B7%CF%84%CE%B9%CE%BA%CE%AE-%CE%9A%CF%89%CE%B4%CE%B9%CE%BA%CE%BF%CF%80%CE%BF%CE%AF%CE%B7%CF%83%CE%B7-%CE%9A%CF%8E%CE%B4%CE%B9%CE%BA%CE%B1-%CE%A6%CE%BF%CF%81%CE%BF%CE%BB%CE%BF%CE%B3%CE%AF%CE%B1%CF%82-%CE%95%CE%B9%CF%83%CE%BF%CE%B4%CE%AE%CE%BC%CE%B1%CF%84%CE%BF%CF%82.pdf |
| S6 | Law 5162/2024, ΦΕΚ Α΄ 198/05.12.2024 (art. 3 tax on professional activity abolished for individuals; art. 6 minimum income) | https://www.aade.gr/sites/default/files/2024-12/%CE%9D%205162%202024%20%CE%A6%CE%95%CE%9A%20198.pdf |
| S7 | AADE guide for persons with disability, Oct 2023 (note on solidarity contribution) | https://www.aade.gr/sites/default/files/2024-03/xristik_odig_AMEA.pdf |
| S8 | AADE FAQ on withholding-fee certificates for tax year 2025 (19 Jan 2026) | https://www.aade.gr/sites/default/files/2026-01/FAQs_vev_amoiv_epixeirimat_2025.pdf |
| S9 | AADE FAQ on withholding returns (19 Apr 2021), item 9 on εργόσημο | https://www.aade.gr/sites/default/files/2021-04/FAQs_paraktratoumenoi_fmy_19_4_21.pdf |
| S10 | e-EFKA circular 2/2025 (contributions 2025, non-salaried) | https://e-efka.gov.gr/sites/default/files/2025-01/%CE%95%CE%B3%CE%BA%CF%8D%CE%BA%CE%BB%CE%B9%CE%BF%CF%82%202-2025.pdf |
| S11 | e-EFKA circular 6/2026 (contributions 2026, non-salaried) | https://www.e-efka.gov.gr/sites/default/files/2026-02/%CE%91%CF%83%CF%86%CE%B1%CE%BB%CE%B9%CF%83%CF%84%CE%B9%CE%BA%CE%AD%CF%82_%CE%B5%CE%B9%CF%83%CF%86%CE%BF%CF%81%CE%AD%CF%82_%CE%AD%CF%84%CE%BF%CF%85%CF%82_2026_%CE%BC%CE%B7_%CE%BC%CE%B9%CF%83%CE%B8%CF%89%CF%84%CF%8E%CE%BD_%CE%95%CE%BB%CE%B5%CF%85%CE%B8%CE%AD%CF%81%CF%89%CE%BD_%CE%95%CF%80%CE%B1%CE%B3%CE%B3%CE%B5%CE%BB%CE%BC%CE%B1%CF%84%CE%B9%CF%8E%CE%BD_%CE%91%CF%85%CF%84%CE%BF%CE%B1%CF%80%CE%B1%CF%83%CF%87%CE%BF%CE%BB%CE%BF%CF%8D%CE%BC%CE%B5%CE%BD%CF%89%CE%BD_%CE%91%CE%B3%CF%81%CE%BF%CF%84%CF%8E%CE%BD_V1.pdf |
| S12 | e-EFKA page: freelancers and self-employed (2026 classes) | https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/eleftheroi-epaggelmaties-aftoapasxoloumenoi |
| S13 | e-EFKA page: new freelancers (special class, 2026) | https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/neoi-epaggelmaties |
| S14 | e-EFKA page: parallel insurance, case 1 (freelancer + salaried job) | https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/parallhlh-asfalish/Periptosh-proth |
| S15 | e-EFKA page: parallel insurance, new freelancer + salaried job | https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/parallhlh-asfalish/Periptosh-trith |
| S16 | e-EFKA FAQ: insurance and contributions | https://www.e-efka.gov.gr/el/sychnes-eroteseis/sychnes-eroteseis-kai-apanteseis/asphalise-eisphores |
| S17 | e-EFKA FAQ: contributions of freelancers, self-employed and farmers | https://www.e-efka.gov.gr/el/sychnes-eroteseis/asphalisi-eisphores/asphalismenoi/me-misthotoi-0/nees-eisphores-apo-112020/nees-eisphores-eleytheron-epaggelmation-aytotelos-apascholoymenon-kai-agroton |
| S18 | e-EFKA FAQ: εργόσημο (former IKA-ETAM) | https://www.e-efka.gov.gr/el/sychnes-eroteseis/asphalisi-eisphores/asphalismenoi/ergosemo/ergosemo-t-ika-etam |
| S22 | e-EFKA page: parallel insurance (index of the five cases) | https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/parallhlh-asfalish |
| S19 | VAT Code (ν. 5144/2024), AADE consolidated text up to 31.12.2024 (arts 26, 43, 44) | https://www.aade.gr/sites/default/files/2025-05/kodikas_fpa_n.5144_2024%20kodikopoiisi_eniaio_keimeno%20@%20eos%2031.12.2024_0.pdf |
| S20 | AADE guide to the EU small-business VAT scheme, 29 Jan 2026 | https://www.aade.gr/sites/default/files/2026-01/odigos_mikr_epixeiriseon.pdf |
| S21 | AADE FAQ on the small-business VAT scheme, 30 Dec 2025 | https://www.aade.gr/sites/default/files/2026-01/FAQs_eidiko_kathestos_mikrwn_epixeir.pdf |

## 1. Income tax on business income (tax years 2025 and 2026)

### 1.1 Scale (one scale for employment, pensions and business profit)

Business profit is taxed with the same scale as employment and pension income, after it is added to employment and pension income [S3 section 3.3; S2 question 23; S1 art. 3 par. 4 (new art. 29 par. 1 ΚΦΕ)].

**Tax year 2025** (scale in force for incomes of tax years 1.1.2020 to 31.12.2025) [S2 question 23; S3 section 3.1]:

| Taxable income band (EUR) | Rate |
|---|---|
| 0 to 10,000 | 9% |
| 10,000.01 to 20,000 | 22% |
| 20,000.01 to 30,000 | 28% |
| 30,000.01 to 40,000 | 36% |
| above 40,000 | 44% |

**Tax year 2026** (law 5246/2025 art. 3 replaces art. 15 par. 1 ΚΦΕ; art. 47 par. 3 says it applies to incomes of tax year 2026 onward) [S1 art. 3 and art. 47]:

| Taxable income band (EUR) | Rate |
|---|---|
| 0 to 10,000 | 9% |
| 10,000.01 to 20,000 | 20% |
| 20,000.01 to 30,000 | 26% |
| 30,000.01 to 40,000 | 34% |
| 40,000.01 to 60,000 | 39% |
| above 60,000 | 44% |

The table in the law is headed "Income (salaries, pensions, business activity)" [S1 art. 3 par. 1]. So the 2026 scale is explicitly for business activity too.

### 1.2 Optional reductions of the 2026 scale (children, young taxpayers)

From tax year 2026 [S1 art. 3 par. 1, new art. 15 par. 1 (β) to (ε)]:
- **Dependent children** (as defined in art. 11 par. 1 (β) ΚΦΕ). The 20% rate of the second band (10,000.01 to 20,000) becomes 18% with 1 child, 16% with 2 children, 9% with 3 children. With 4 or more children the first two bands are taxed at 0%.
- The 26% rate of the third band (20,000.01 to 30,000) becomes 24% (1 child), 22% (2), 20% (3), 18% (4). Each extra child above 4 lowers that rate by another 2 percentage points.
- **Age.** For taxable income up to 20,000 the rates of the first two bands are 0% for taxpayers up to 25 years old, and 9% for taxpayers aged 26 to 30 (0% if the 4+ children rule applies).

**Can the app model them?** Yes, as optional inputs: `dependentChildren` (0 to 6+) and `ageBand` (`"<=25"`, `"26-30"`, `"31+"`). They only change the `rateBps` of bands 2 and 3, and the first two bands for age. The 2025 scale has no such variants (children matter in 2025 only through the art. 16 reduction, section 1.3).
- **[uncertain]** The law text says "for taxable income up to 20,000"; I read it as applying to the total taxable income, including business profit, because art. 29 par. 1 (new) sends business profit to "par. 1 of art. 15". I found no AADE example for a mixed employment plus business case. Also the age rule needs the taxpayer's age at which date (end of tax year?). Not stated in the text I read.

### 1.3 The employment tax reduction (art. 16 ΚΦΕ) and how it stacks with business income

- Art. 16 reduces the tax computed on the employment and pension scale by: 777 EUR (no children), 900 (1 child), 1,120 (2), 1,340 (3), 1,580 (4), 1,780 (5), plus 220 per further child. If taxable employment and pension income is above 12,000 EUR, the reduction falls by 20 EUR per 1,000 EUR of that income, down to zero. The reduction is capped at the tax itself. The phase-out is not applied to taxpayers with 5 or more children [S2 question 23; S3 section 3.1].
- Art. 16 was not amended by law 5246/2025: art. 3 changes only arts 15, 29 and 60 ΚΦΕ, and a text search of the whole law finds no other change to art. 16 [S1 art. 3]. So the 2026 reduction amounts are the same as 2025 as far as I can tell **[uncertain: I did not find a document that restates the 2026 amounts]**.
- **Rule for business profit.** "For profits from business activity the reductions of art. 16 do not apply" [S5 art. 29 par. 1; S3 section 3.3; S2 question 23; S1 art. 3 par. 4].
- **Rule when employment and business income both exist.** The Code says business profit is "added" to employment and pension income and the scale is applied to the sum [S5 art. 29 par. 1; S1 art. 3 par. 4]. The reduction of art. 16 is then limited to the part of the income that comes from employment and pensions: for farmers mixed with employment, the text says the reduction is "the one that corresponds to the part of the income from employment and pensions" [S1 art. 3 par. 4; S3 section 2.7.1]. For plain business plus employment the sources I read say only that the reductions "do not apply to business profits".
- **Exact stacking rule used by this estimator (my reading; [uncertain] in the details):**
  1. `E` = taxable employment and pension income (including εργόσημο net, section 1.8), `B` = net business profit (after expenses and after deductible EFKA contributions, floored at 0 for the year).
  2. `taxScale = scale(E + B)` on the single scale of the year.
  3. `reductionBase = 777 EUR` (or the child amount), minus 20 EUR per 1,000 EUR of `E` above 12,000 EUR, floored at 0 (phase-out measured on employment income only, as the AADE text says "taxable income from salaries and pensions" [S2 question 23]).
  4. `reduction = min(taxScale, reductionBase * E / (E + B))` (reduction prorated by the employment share).
  5. `tax = taxScale - reduction`.
  The proration in step 4 and the proportional (not per-full-1,000) phase-out are my reading. The error is at most the reduction (max 777 EUR for no children). An accountant should confirm.
- The app should compute the invoice's income tax as the **marginal** change in `tax` when this invoice's net business income is added (section 7).

### 1.4 Business expenses and deductible EFKA contributions

- Business profit is receipts minus deductible expenses (art. 22 ΚΦΕ: expenses in the interest of the business, real, recorded and documented) [S5 art. 22].
- The self-employed person's own EFKA contributions are deducted when computing net business income: the E3 form computes code 453 as code 461 minus "Insurance contributions of the self-employed" (table Ζ2, sub-table of code 485, case 7) [S4, codes 453/485]. The e-EFKA page says contributions are decoupled from taxable income (they depend on the class chosen, not on income) [S12].
- Tax paid on income is never deductible, and no other deduction is modelled in the app.

### 1.5 First-years reduction of the first band (new sole proprietors)

Art. 29 par. 2 ΚΦΕ: for natural persons with a first start-of-activity declaration, for the first three years of the activity, the rate of the **first band is cut by 50%** if annual gross business income does not exceed 10,000 EUR [S5 art. 29 par. 2; S3 section 3.3]. So 9% becomes 4.5% on the first band, only while gross business receipts are at most 10,000 EUR.
- The E1 instructions text says "first declaration of start of activity from 1 January 2023" while the Code text says "from 1 January 2013" [S3 section 3.3 vs S5 art. 29 par. 2]. **[uncertain]** which start date applies; for a person who started in 2025 both versions give the same answer (eligible).
- The cut is on the first-band rate of the scale as it applies to the combined income. How it is applied when employment income already fills the first band is not explained in the pages I read **[uncertain]**. The app default: do not apply it (conservative), keep as an optional flag `newSoleProprietorBracketCut`.
- In the worked example (section 8) gross business receipts are 12,000 EUR (above 10,000), so it does not apply.

### 1.6 Minimum presumed net income of the self-employed (art. 28A to 28D ΚΦΕ)

- What it is: from tax year 2023, net business income of a sole proprietor is presumed to be at least a minimum amount. If actual profit is lower, tax is calculated on the minimum [S2 "Προσδιορισμός φόρου…"; S5 art. 28A].
- Amount (art. 28A par. 2 as replaced by law 5162/2024 art. 6): up to 50,000 EUR in total, made of: (a) the annual gross legal minimum wage (the minimum wage in force on the last day of the tax year), raised by 10% for the three years after the second three-year period from the start-of-activity declaration, and by a further 10% for each following three-year period; plus (b) up to 15,000 EUR equal to 10% of annual payroll cost of staff; plus (c) 5% of the turnover above the average turnover of the person's main KAD (activity code). If (a)+(b)+(c) is under 30,000 EUR and the best paid employee earns more, that salary is used up to 30,000 EUR [S6 art. 6; S5 art. 28A].
- **Exemptions and reductions (art. 28C par. 1, as replaced by law 5246/2025 art. 6):** arts 28A and 28B do not apply for the **first three years** from the first start of the professional activity. In the fourth year the minimum is "reduced by two thirds (2/3)"; in the fifth year it is "reduced by one third (1/3)" [S1 art. 6]. The wording "reduced by 2/3" most likely means the person pays presumed tax on one third of the amount, but the text does not spell out the result. **[uncertain]**
- Other reductions: by half for large families, disability of 67% or more, single parents with minors, and others; by half in small settlements and small islands [S1 art. 6 (art. 28C pars 2 and 3)]. New mothers: no minimum in the year of birth, adoption or fostering and the two following years [S1 art. 5, art. 28A par. 6 (ζ)]. The objective grounds to contest the minimum (military service, hospitalisation, pregnancy, disaster, and so on) are in art. 28A par. 3 [S5 art. 28A par. 3; S1 art. 5].
- The minimum is pre-filled by AADE in the E1 (codes 405-406) and tax is calculated on it if it is higher than actual profit [S2 "Προσδιορισμός φόρου…"].
- **Recommendation for the app:** do NOT include the minimum in the default reserve. Provide an optional toggle `applyMinimumPresumedIncome`, default off, labelled "[uncertain] estimate". Show a hint when the activity start year makes the person liable (fourth year or later). For a person in the second year (as in the example) it does not apply. I did not find the 2026 annual gross minimum wage in an official page I opened, so the app must ask the user for it **[uncertain]**.

### 1.7 Solidarity contribution and professional fee (τέλος επιτηδεύματος)

- **Special solidarity contribution (ειδική εισφορά αλληλεγγύης, art. 43A ΚΦΕ):** abolished for all income obtained from 1.1.2023 onward (art. 177 of law 4972/2022, as stated in AADE's guide) [S7 section 3.3]. The 2024 ministry codification still prints the old article text [S5 art. 43A], so the AADE note is the up-to-date statement. Not due for 2025 or 2026. The app must not add it.
- **Professional fee (τέλος επιτηδεύματος):** abolished for natural persons from tax year 2024 (law 5162/2024 art. 3 replaces art. 31 of law 3986/2011 so that only legal persons and legal entities pay it; art. 3 applies from tax year 2024) [S6 art. 3 and the commencement article, par. 5 (α)]. Not due for 2025 or 2026 for a sole proprietor.

### 1.8 How εργόσημο pay is taxed

- Εργόσημο is a voucher paid via e-EFKA for short jobs. When it is redeemed, **no income tax is withheld**, only insurance contributions [S9 item 9].
- In the E1 tax return, the amount to declare is the net amount: "face value minus insurance contributions", as printed on each voucher, in codes 309-310 of sub-table 4Α, which is the table for "income from employment and pensions" [S3 sections 2.5 and 2.5.6]. So it is **employment income**: it adds to `E`, uses the employment scale, and the art. 16 reduction can apply to it.
- Because no tax is withheld, the tax on εργόσημο is paid with the annual return. The app should include εργόσημο net pay in `E` and, if the user wants, reserve the tax on it as employment income (marginal tax of that pay on top of the rest). In this research the tax-reserve feature targets freelance invoices; treat εργόσημο as an input to `E`.
- Contributions on εργόσημο are in section 2.6.

### 1.9 Tax-year facts that do not change the estimate

- Dependent child count enters only through the optional inputs above.
- Tax credits and deductions for donations (20%) and the 30% deduction for electronic payments (up to 5,000 EUR; extended to tax year 2026) exist [S3 section 3.2; S1 art. 4], but the app does not model them. They would lower tax. Leaving them out makes the estimate conservative.
- Living-cost presumptions (τεκμήρια) are out of scope.

## 2. EFKA contributions for the self-employed (2025 and 2026)

All amounts are monthly, in EUR. "Main insurance" = pension plus health. The parts: pension (Κλάδος Σύνταξης), health cash (Υγεία σε χρήμα), health in kind (Υγεία σε είδος).

### 2.1 Main insurance classes

Freelancers and self-employed persons have **6 classes plus a special class for new professionals** (7 in total) [S17]. The class is chosen freely, once a year, by an application in a set window (for 2026 the deadline was Saturday 31/01/2026) [S12, S13, S17].

**2025** (e-EFKA circular 2/2025, indexation +2.7%, ministerial decision Δ.15/Δ΄/1984/2025, ΦΕΚ Β΄ 241/29.01.2025) [S10]:

| Class | Pension | Health cash | Health in kind | Total |
|---|---|---|---|---|
| 1 | 180.58 | 5.82 | 58.25 | 244.65 |
| 2 | 216.70 | 6.99 | 69.90 | 293.59 |
| 3 | 274.95 | 6.99 | 69.90 | 351.84 |
| 4 | 346.01 | 6.99 | 69.90 | 422.90 |
| 5 | 429.89 | 6.99 | 69.90 | 506.78 |
| 6 | 582.50 | 6.99 | 69.90 | 659.39 |
| Special (new professional) | 108.35 | 3.49 | 34.95 | 146.79 |

**2026** (e-EFKA circular 6/2026 of 03/02/2026, indexation +2.5%, ministerial decision Δ.15/Δ΄/1865/2026, ΦΕΚ Β΄ 318/29.01.2026; applies from 1 January 2026) [S11]. The e-EFKA pages show the same totals [S12, S13]:

| Class | Pension | Health cash | Health in kind | Total |
|---|---|---|---|---|
| 1 | 185.09 | 5.97 | 59.71 | 250.77 |
| 2 | 222.12 | 7.16 | 71.65 | 300.93 |
| 3 | 281.82 | 7.16 | 71.65 | 360.63 |
| 4 | 354.66 | 7.16 | 71.65 | 433.47 |
| 5 | 440.64 | 7.16 | 71.65 | 519.45 |
| 6 | 597.06 | 7.16 | 71.65 | 675.87 |
| Special (new professional) | 111.06 | 3.58 | 35.82 | 150.46 |

(The e-EFKA pages show "Health" as one number: 65.68 for class 1 = 5.97 + 59.71, and 78.81 for classes 2 to 6 = 7.16 + 71.65; special class 39.40 = 3.58 + 35.82 [S12, S13].)

### 2.2 Other monthly parts

- **Unemployment (ΟΑΕΔ, now ΔΥΠΑ):** 10.00 EUR a month is collected together with the contributions, in 2025 and 2026 [S10, S11]. For health professionals an extra 2.00 EUR (Στέγη Υγειονομικών) is collected [S10, S11]. Both are collected only when no matching contribution is paid through salaried work [S14, S15].
- **Supplementary insurance (επικουρική), 3 classes, for insured persons entitled to that branch** [S12, S16]: 2025: 45.43 / 54.76 / 65.25 [S10]. 2026: 46.57 / 56.13 / 66.88 [S11].
- **Lump-sum benefit (εφάπαξ), 3 classes, for insured persons entitled to that branch** [S12]: 2025: 30.29 / 36.12 / 43.10 [S10]. 2026: 31.05 / 37.02 / 44.18 [S11].
- **[uncertain]** Who is "entitled" to the supplementary and lump-sum branches (the pages say "for insured persons entitled", without defining it). The app should have two flags, `supplementaryApplies` and `lumpSumApplies`, and an accountant or the user's EFKA notice settles them. Both are paid once, in the chosen class, and only if matching contributions are not already paid from salaried work [S14].
- Indexation: amounts rise each year by the previous year's average CPI change by a ministerial declaratory act (law 4387/2016 art. 8 par. 3 as amended by law 5167/2024 art. 38) [S10, S11]. So the 2027 amounts will change; this is why the config is per year.

### 2.3 Default and minimum class

- The class choice is mandatory and binding for the whole year [S13, S17].
- If you do not apply in the window, the previous year's class stays active [S12, S13, S17]. **[uncertain]** An older e-EFKA FAQ page says that without a choice you pay the 1st class [S16]. The pages for 2026 (S12, S13, S17) say the previous class continues. I use "previous class continues" and flag it.
- Lowest standard class: class 1. The special class is lower still but is allowed only for new professionals (below). For the estimator the default class is the user's chosen class (an input). If unknown: class 1 (standard) or the special class for a new professional.

### 2.4 New professionals (special class)

- Who: new insured freelancers and self-employed persons. They "can choose the special category and stay in it for their first five years of insurance". If the person has fewer than five years of insurance, the special class applies until the five years complete (within the year, the choice lasts the whole year unless the five years complete during the year) [S13].
- If the activity is interrupted and then restarted, the reduced contribution is not available again, even if five years were not completed [S16, S17].
- Not allowed to choose the special class if the person has several non-salaried activities [S17].
- 2026 amount: 150.46 EUR a month (111.06 pension + 39.40 health), against 250.77 EUR for class 1 [S13]. 2025 amount: 146.79 [S10].
- Supplementary and lump-sum contributions are still paid in addition, if applicable (section 2.2) [S13].
- The e-EFKA pages do not state an age limit. **[uncertain]** whether any other condition (such as age) applies.

### 2.5 Salaried employment at the same time (parallel insurance)

The user is salaried and also freelances. Under the new system the person pays "one single contribution" even with parallel insurance, and the calculation depends on the case (five cases are listed) [S22].
- **Freelancer with a salaried job (standard class)** [S14]: the person chooses any of the six classes. The contributions paid through the salaried job are **subtracted** from the contributions of the chosen class. During parallel employment, the minimum contributions cannot be lower than the **2nd class** amount. If a class above the 2nd is chosen, only the difference is paid, and only for the pension branch. Supplementary and lump-sum: one contribution, only if matching ones are not paid from salaried work. Unemployment 10 EUR (and 2 EUR housing for health workers) only if not matched by salaried work. If the salaried job ends, the contribution follows the chosen class and the whole amount is borne by the insured person.
- **New freelancer with a salaried job who chose the special class** [S15]: they pay the contributions of the **1st class** (250.77 EUR in 2026). The contributions paid through the salaried job are subtracted from the 1st-class amount. If the salaried job ends, the contribution is on the special class, fully borne by the person.
- **[uncertain]** A general e-EFKA FAQ says the amount "cannot be lower than the 1st class" for the special-class plus employment case, and the same FAQ says the 2nd class for multiple self-employed activities plus employment [S17]. This agrees with S15. The 1st-class floor for new professionals and the 2nd-class floor for others is how I read S14/S15/S17.
- **[uncertain] Which salaried contributions are counted, and whether the offset is calculated month by month.** The pages say "contributions paid from the salaried work". They do not say whether this means the employee and employer shares together, or the pension and health parts only. My own inference, not from a source: with a normal salary, the contributions paid through payroll can exceed the 1st-class amount, so the freelance main-insurance amount for those months could be zero. I did not find any official worked example. The app should therefore take the monthly figure `salariedContributionsMonthlyMinor` as a user input (default 0 = conservative) and subtract it as the pages describe.
- A person insured for the first time as a freelancer must register: "the e-EFKA declaration is due by the tenth day of the month after the month the activity began with the tax authority" (found only in a search summary; not confirmed on a page I opened) **[uncertain]**.

### 2.6 Payment, due date, deductibility, εργόσημο

- **Due date.** Payments are made through an e-EFKA payment notice in the insured person's online account; contributions of the previous month are billed in the first days of the third ten-day period and are processed in the second ten-day period of each month [S17]. Late payment adds legal surcharges; unpaid amounts become overdue after the debt certificate (Π.Β.Ο.) is issued the month after the due date [S17]. I did not find an official page that states the legal due date as a rule. **[uncertain]** The commonly cited rule "last working day of the following month" appears in e-EFKA text only for one special case [search snippet; not confirmed]. The app should treat the due date as: contributions for month M are payable by the last working day of month M+1 `[uncertain]`, and let the user override.
- **Deductible from business income?** Yes: the self-employed person's contributions are deducted in the E3 net-income calculation (code 453 = code 461 minus contributions of the self-employed) [S4]. See also section 1.4.
- **Contributions withheld by the client.** For a person who invoices with a service-provision invoice (Δελτίο Παροχής Υπηρεσιών) and whose client withholds the EFKA contributions, the person still files E3 and deducts the contributions paid by the client from receipts [S8 item 19].
- **εργόσημο contributions** [S18, S9]: contributions are withheld when the voucher is redeemed. For vouchers of the former IKA-ETAM, the e-EFKA page lists contributions of 25% of the printed face value (14.45% main pension, 4.65% sickness in kind, 0.86% sickness in cash, 4.32% supplementary, 0.72% employee share for the former OEK) and gives insured days = contribution ÷ 11.63, with at most 25 days a month and 300 days a year [S18]. The page itself notes that 11.63 = 33.57 × 34.65%, which does not match 25%, so the figures are not reconciled **[uncertain]**. Income tax is not withheld [S9]. The employment-income amount to use is the **net amount printed on the voucher** (face value minus contributions) [S3 section 2.5.6]. The app should take the net amount from the voucher as input.
- A person who is salaried or has εργόσημο does not change the freelance class unless parallel-insurance offsets apply (section 2.5). **[uncertain]** whether contributions paid through εργόσημο count as "contributions paid from salaried work" for the offset. I did not find a statement.

### 2.7 Summary for the estimator

Monthly EFKA for a month = (selected class main amount + optional supplementary + optional lump sum + 10.00 unemployment [+ 2.00 for health workers]) minus the parallel-insurance offset the user enters, floored at the floor class where the page says so. For a new professional with a salaried job the floor is the 1st class and the base is the special class (S15).

## 3. VAT

### 3.1 Rates

- Standard rate **24%**. Reduced rates 13%, 6% and 4% apply only to the goods and services listed in Annex III of the VAT Code (law 5144/2024, art. 26 par. 1) [S19 art. 26]. A typical freelance service (consulting, design, software, and so on) is at 24% unless it is listed in Annex III **[uncertain: I did not read Annex III]**.
- Islands: a 30% reduction of the rates applies on some islands. Since 1.1.2026 law 5246/2025 art. 11 extends a 30% reduction to islands of the North Aegean Region, the Evros regional unit and the Dodecanese with population up to 20,000 [S1 art. 11, art. 47 par. 5]. The reduction in the Code is applied by a ministerial decision for each case and rounded to the nearest whole point [S19 art. 26 pars 4 and 6]. The app should offer a `vatRateBps` override per tax year and per user (default 2400).

### 3.2 Small-business special scheme (domestic scheme)

The scheme sits in the VAT Code, now numbered **art. 44α** ("domestic scheme"); the 31.12.2024 consolidated text I read still has it as art. 44 [S19 art. 44; S20 section 2.4.4; S21 questions 50 to 62]. The user's brief says art. 39: that is the old numbering in the former VAT Code (ν. 2859/2000); the list of circulars in S19 still mentions "the exemption of small businesses of art. 39 of the VAT Code" (circular Ε.2012/2019) [S19, list under art. 44].

**Threshold and conditions (2025 and 2026).**
- The annual turnover in Greece must not exceed **10,000 EUR**, both in the previous calendar year and in the current calendar year [S20 section 2.4.4; S21 question 51].
- Turnover is the value without VAT of the supplies of goods and services in Greece. Sales of capital goods and exempt transactions without a right of deduction are not counted [S19 art. 44 par. 1; S21 question 50 (ε)]. Turnover outside Greece is not counted [S20 section 2.4.4; S21 question 50 (δ)].
- Entry: when the activity starts (choose the scheme in the start-of-activity declaration) or any time in the year by a declaration of changes [S21 question 52]. Since 2025 the move between schemes is possible at any time in the year, and for a business running less than a year there is no longer a conversion to an annual figure [S21 question 50 (α) to (γ)].
- Effects: no VAT charged on supplies in Greece, no periodic VAT returns, and **no right to deduct input VAT**. Invoices must carry the wording "Χωρίς Φόρο Προστιθέμενης Αξίας - Απαλλαγή μικρών επιχειρήσεων" [S21 questions 53 and 54; S19 art. 44 par. 9].
- Exceeding the limit: the scheme stops from the transaction that crosses 10,000 EUR, and that whole transaction is invoiced with VAT. A declaration of changes is due within 30 days [S21 questions 56 and 57]. Re-entry is possible from the next tax year if the limits are met [S21 question 59].
- Not available to: farmers in the special agricultural scheme, and taxable persons not established in Greece [S19 art. 44 par. 2].

**EU small-business scheme from 2025-01-01 (Directive (EU) 2020/285, VAT Code arts 44β and 44γ).** It lets a small business established in one Member State also be exempt in other Member States where the local limit allows. The EU-wide limit is 100,000 EUR of annual EU turnover (current or previous year), and each Member State sets its own national limit (maximum 85,000 EUR). Greece's own limit for the domestic scheme stays 10,000 EUR [S20 sections 2.4.4 and 2.4.5; S21 sections 4 to 6]. For a freelancer who invoices only Greek clients this changes nothing. The app should show the cross-border scheme only as a note.

### 3.3 Filing frequency and deadlines (normal regime)

- Tax period: one calendar month for taxable persons with double-entry books; one calendar quarter for those with single-entry (simplified) books and for those not obliged to keep books or issue sales documents [S19 art. 43 par. 1]. A typical sole freelancer keeps simplified books **[uncertain: the books category is the person's accountant's choice]**.
- Deadline to file: the last working day of the month after the end of the period (for quarterly: 30 April, 31 July, 31 October, 31 January or the previous working day) [S19 art. 43 par. 4].
- Payment: by the last working day of the month in which the filing deadline falls (same date). If the amount due is above 100 EUR and the return is on time, the person can pay in two equal interest-free instalments; the second is due by the last working day of the next month [S19 art. 43 par. 6].
- If the balance is 30 EUR or less it is carried to the next period; a negative balance is carried forward or refunded [S19 art. 43 par. 6].
- Chargeability: the tax becomes due when the service is performed, and by exception at the time of issue of the invoice (art. 21 par. 2 (α)) [S19 art. 21]. For the estimator: VAT is reserved at the invoice date.
- The VAT due for a period = output VAT charged minus deductible input VAT of the period (the right of deduction is in art. 35) [S19 art. 35 and art. 43 par. 6]. The app can support an input-VAT figure per month as an optional input; the default is 0 (conservative).

### 3.4 How VAT appears on an invoice

- Normal regime: the invoice shows the net amount, the VAT rate, the VAT amount and the gross total. Example: net 1,500.00 EUR, VAT 24% = 360.00 EUR, total 1,860.00 EUR. The client pays the gross; the VAT part is not income of the freelancer.
- Small-business scheme: the invoice shows no VAT and carries the exemption wording above [S19 art. 44 par. 9].

## 4. Tax prepayment (προκαταβολή φόρου)

- **Rate.** An amount equal to **55%** of the tax resulting from business activity, for the tax of the current tax year, minus withheld and prepaid taxes, is assessed together with the annual return [S5 art. 69 par. 1; S3 section 3.4; S2 question 26]. These are the rules in the sources I read for the 2025 return; I found no 2026 amendment (a text search of law 5246/2025 finds no change to art. 69 or to the word "προκαταβολή") **[uncertain]** for the 2026 return.
- **Which tax.** Only the tax from the business activity counts. Tax on other income (employment, pensions, capital) is not included [S3 section 3.4; S2 question 26]. **[uncertain]** how "the tax from business activity" is split when employment income is also present: the sources do not give a formula. My default is the proportional share, `taxTotal * B / (E + B)`, with the marginal method as an alternative (config flag). In the worked example the proportional share gives 903.57 EUR and the marginal method 1,504.32 EUR.
- **New-professional reduction.** The Code and the AADE texts have one reduction, and it is for **the first time** the person declares business income: the amount is limited to **half** [S5 art. 69 par. 1 (last sentence); S3 section 3.4; S2 question 26]. This covers first-time business income, including income of people without a start-of-activity registration, and a first-time added presumed-expenses difference [S2 question 26]. So the reduction lasts **one year**, not several. (For new legal entities there is a 3-year halving, which does not apply to a sole proprietor [S2, legal-person question 3].)
- **Fees with 20% withholding.** No prepayment is calculated or paid for income on which tax is withheld under art. 64 par. 1 (δ) (20% on fees) [S5 art. 69 par. 5 (β)]. So the app should exclude invoices flagged "20% withheld by client" from the prepayment base.
- **Amounts under 30 EUR** are not assessed [S5 art. 69 par. 2].
- **Reduction request.** If the income falls by more than 25%, the taxpayer can ask for a reduction of the prepayment by 30 September of the year of assessment [S5 art. 70].
- **When it is credited.** The prepayment is assessed with the return of year N (for the income of year N+1, "the current tax year") and paid in the same instalments as the tax of year N. At the clearance of year N+1 it is deducted from the tax of N+1 [S5 art. 69 par. 1 ("minus … prepaid taxes"); S3 section 3.4]. **[uncertain]** I did not find an official line that says it is paid in the same eight instalments, only that tax is paid in eight instalments [S2 question 36]. The text of art. 69 par. 1 says the prepaid amount is deducted when the tax of the year is assessed.
- **Reserve view.** In a steady state the prepayment is not extra tax; it moves part of next year's tax into this year's cash flow. The estimator shows it as "cash due with the return, of which prepayment" so the user sees the cash shock in the first full year (tax of year N plus the prepayment for N+1).

## 5. Withholding on fees (ΚΦΕ art. 64)

- **Rate.** 20% on fees "for technical works, management fees, consulting or similar services" (art. 64 par. 1 (δ)) when the recipient is a natural person [S5 art. 62 par. 1 (δ) and art. 64 par. 1 (δ)]. Legal persons that are tax resident in Greece or in the EU/EEA are not subject to this withholding [S5 art. 62 par. 2].
- **Base.** The 20% is applied on the **gross fee**, before the insurance contributions the person bears, and VAT is not part of the fee [S8 item 19 for the gross-before-contributions rule]. **[uncertain]** that VAT is excluded: not stated in the pages I read, but it is the normal base.
- **Threshold.** For a recipient who is tax resident in Greece, tax is withheld only if the transaction exceeds **300 EUR** [S5 art. 64 par. 8]. AADE's FAQ also says that if 20% was withheld on a fee below 300 EUR, it is reported anyway [S8 item 13].
- **Who withholds.** Every legal person or entity, and every natural person carrying on business, that is tax resident in Greece, plus general-government bodies [S5 art. 61]. So a business client is a withholding agent; a private individual who is not in business is not.
- **General-government clients.** General-government bodies (except capital companies) withhold income tax on supplies of goods and services: 1% on liquid fuels and tobacco, 4% on other goods, **8% on services**, computed on the net value (without VAT). Exempt: transactions up to 150 EUR net where no contract is needed, and cases where another provision already requires withholding or prepayment on the same income [S5 art. 64 par. 2].
- **Credit against the final tax.** The withholding on fees does not exhaust the tax of a Greek tax resident; the withheld tax is credited against the income tax assessed on the business income [S5 art. 64 pars 3 and 4]. It lowers the cash due at the annual return. The app should track `withheldTaxMinor` per invoice and subtract it in the year-end true-up. Because it is only a prepayment of the same tax, the reserve is not reduced at invoice time (conservative), but the cash the freelancer receives is lower. The app should show both.
- **Does the rule depend on whether the client is a business or a private person?** Yes (art. 61): only business clients and general-government bodies withhold. **[uncertain]** which services count as "consulting or similar" is defined in AADE circular ΠΟΛ.1120/2014, which I did not open (S8 item 19 refers to it). The app should let the user flag each invoice "client withheld 20%" instead of guessing.
- **Reporting.** Payers file annual certificates of fees (the 2025 file was due by 27 February 2026) [S8 items 2 and 3].

## 6. Calendar

| Item | Rule | Source |
|---|---|---|
| Income tax return (tax year 2025) | Filed from 16 March to 15 July 2026 | [S2 question 35] |
| Payment of tax | Eight equal monthly instalments; the first by 31 July 2026, the others by the last working day of the next seven months | [S2 question 36] |
| Early-payment discount | 4% if filed by 15 May, 3% if by 15 June, 2% if by 15 July, provided the tax is paid by 31 July (lump sum) | [S2 question 36] |
| Return for tax year 2026 | Dates for 2027 are not published yet. By analogy: file from mid-March to mid-July 2027; first instalment at the end of July 2027 **[uncertain]** | inference |
| Prepayment | Assessed with the return; paid with the same instalments **[uncertain]** (section 4) | [S5, S2] |
| VAT returns (normal regime) | Monthly or quarterly, by the last working day of the next month; tax paid the same day; two interest-free instalments possible above 100 EUR | [S19 art. 43] |
| VAT exempt (small business) | No periodic return | [S21 question 53] |
| EFKA monthly contribution | For month M: payment notice in the e-EFKA account; legal due date not confirmed **[uncertain]**; assume the last working day of month M+1 | [S17] |
| EFKA class choice | Once a year; deadline for 2026 was 31/01/2026; if you do nothing the previous class continues **[uncertain]** | [S12, S13, S17] |
| Withholding certificates (payers) | For tax year 2025 by 27 February 2026 | [S8 item 3] |
| Tax discount on early filing | See above | [S2] |

## 7. Estimation algorithm

Conventions: `Cents` = integer euro cents; `Bps` = integer basis points. Rounding is **half up to the cent at every step** (`rhu(n, d) = floor((2n + d) / (2d))` for non-negative integers). All inputs come from the per-year config (section 9). All outputs carry the label "estimate, not tax advice; confirm with an accountant".

### 7.1 Types

```ts
type Cents = number;           // integer
type Bps = number;             // integer, 10000 = 100%

interface TaxProfile {                 // per user, per tax year
  taxYear: 2025 | 2026;
  // income tax
  employmentIncomeMinor: Cents;        // E: forecast annual TAXABLE employment + pension income, incl. εργόσημο net
  dependentChildren: number;           // optional, default 0
  ageBand: "<=25" | "26-30" | "31+";   // optional, default "31+"
  applyNewSoleProprietorBandCut: boolean;       // default false
  applyMinimumPresumedIncome: boolean;          // default false
  minimumPresumedIncomeMinor?: Cents;           // user input if applied
  // EFKA
  efkaClassId: "1"|"2"|"3"|"4"|"5"|"6"|"special";
  hasParallelSalariedEmployment: boolean;
  salariedContributionsMonthlyMinor: Cents;     // user input, default 0 (conservative)
  supplementaryClass?: "1"|"2"|"3";             // undefined = not applicable
  lumpSumClass?: "1"|"2"|"3";
  extrasCoveredBySalary: boolean;               // default false
  healthProfessional: boolean;                  // adds the 2.00 EUR housing contribution
  // VAT
  vatRegime: "normal" | "smallBusinessExempt";
  vatRateBps: Bps;                              // default config.vat.standardRateBps
  previousYearGreekTurnoverMinor: Cents;        // for the small-business test
  inputVatMonthlyMinor?: Record<string, Cents>; // optional deductible input VAT per month
  // prepayment
  firstTimeBusinessIncome: boolean;             // true only in the first year business income is declared
}

interface Invoice {
  id: string;
  issueDate: string;                // ISO date, interpreted in Europe/Athens
  netMinor: Cents;                  // amount without VAT
  expensesMinor: Cents;             // deductible expenses booked with this invoice, default 0
  clientWithheld20: boolean;        // client withholds 20% under art. 64 par. 1 (δ)
  withheldMinor?: Cents;            // if known; else computed
}

interface InvoiceReserve {
  invoiceId: string;
  vatMinor: Cents;                  // exact
  incomeTaxMinor: Cents;            // marginal tax at the time of the invoice (can change later)
  efkaReleasedMinor: Cents;         // negative number: reserve released by EFKA accrual since the previous event (see 7.4)
  withheldByClientMinor: Cents;
  totalSetAsideMinor: Cents;
}
```

### 7.2 VAT (exact)

```ts
function vatForInvoice(p: TaxProfile, cfg: Cfg, inv: Invoice, ytdGreekTurnoverBefore: Cents): Cents {
  if (p.vatRegime === "normal") return rhu(inv.netMinor * p.vatRateBps, 10000);
  // small-business scheme: exempt only while turnover stays <= threshold in BOTH years
  const T = cfg.vat.smallBusinessThresholdMinor;                 // 1_000_000 = 10,000.00 EUR
  const exemptNow = p.previousYearGreekTurnoverMinor <= T
                    && ytdGreekTurnoverBefore + inv.netMinor <= T;
  return exemptNow ? 0 : rhu(inv.netMinor * p.vatRateBps, 10000); // the crossing invoice is charged in full
}
// Once an invoice crosses T, regime flips to "normal" for the rest of the year (and a declaration
// of changes is due within 30 days). Show a banner. Input VAT (if entered) is deducted in the
// period totals, never per invoice. VAT is reserved at the invoice date.
```

### 7.3 Income tax: scale, reduction, total

```ts
function scaleTax(income: Cents, bands: Band[]): Cents {         // bands from config, rateBps per band
  let tax = 0, prev = 0;
  for (const b of bands) {
    const hi = b.upToMinor === null ? income : Math.min(income, b.upToMinor);
    if (hi > prev) tax += rhu((hi - prev) * b.rateBps, 10000);
    if (b.upToMinor === null || income <= b.upToMinor) break;
    prev = b.upToMinor;
  }
  return tax;
}

function effectiveBands(p: TaxProfile, cfg: Cfg): Band[] {
  // start from cfg.incomeTax.bands; for 2026 apply optional children / age overrides
  // (cfg.incomeTax.dependentChildrenRates, cfg.incomeTax.ageRates). 2025: no overrides.
}

function employmentReduction(E: Cents, cfg: Cfg, children: number): Cents {   // art. 16 base, before proration
  const r = cfg.incomeTax.employmentReduction;
  const base = r.baseByChildrenMinor[Math.min(children, 5)] + Math.max(0, children - 5) * r.extraChildMinor;
  const over = Math.max(0, E - r.phaseOutStartMinor);
  return Math.max(0, base - rhu(over * r.phaseOutBpsOfIncomeOverStart, 10000));
}

function totalIncomeTax(E: Cents, B: Cents, p: TaxProfile, cfg: Cfg): Cents {
  // E: employment+pension taxable income. B: net business profit (>= 0).
  const S = E + B;
  if (S <= 0) return 0;
  const taxScale = scaleTax(S, effectiveBands(p, cfg));
  const R = E > 0 ? Math.min(taxScale, rhu(employmentReduction(E, cfg, p.dependentChildren) * E, S)) : 0;
  return taxScale - R;                       // [uncertain] proration, see section 1.3
}
```

### 7.4 Net business income and the reserve event model

Net business income so far in the year:

```
N(t) = receipts_ytd(t) - expenses_ytd(t) - efkaAccrued_ytd(t)   // all in cents, net of VAT
B(t) = max(0, N(t))                                              // floor at 0 (no loss relief modelled)
if applyMinimumPresumedIncome: B_year = max(B_year, minimumPresumedIncomeMinor)   // year-end view only
```

The income-tax reserve for the year to date is `Reserve(t) = totalIncomeTax(E, B(t)) - totalIncomeTax(E, 0)`: the tax that exists only because of the freelance activity. Every event (invoice, expense, monthly EFKA accrual) changes `N`, and the change in `Reserve` is that event's contribution:

```ts
function reserveDelta(E, Nbefore, Nafter, p, cfg) {
  return (totalIncomeTax(E, max(0,Nafter), p, cfg) - totalIncomeTax(E, 0, p, cfg))
       - (totalIncomeTax(E, max(0,Nbefore), p, cfg) - totalIncomeTax(E, 0, p, cfg));
}
```

- **Per invoice:** `incomeTaxMinor = reserveDelta(E, N_before, N_before + inv.netMinor - inv.expensesMinor)`. It is the marginal tax of adding the invoice on top of `E` plus the year-to-date business income, as the brief requires.
- **EFKA accrual** is booked at each month end (see 7.5); it reduces `N`, so it **releases** a little reserve (negative delta). Show it as "EFKA deduction effect" in the month view, not on any invoice.
- Result: the sum of all deltas in the year equals `totalIncomeTax(E, B_year) - totalIncomeTax(E, 0)` (telescoping), so month and year totals are consistent by construction.
- If the user changes `E` (a new salary forecast), recompute the reserve for the year from the events; show the change as one "forecast change" line, not by rewriting history.

### 7.5 EFKA (class amount, prorated)

```ts
function efkaMonthly(p: TaxProfile, cfg: Cfg, month: string): Cents {
  const cls = (id) => cfg.efka.classes.find(c => c.id === id)!.monthlyMinor;
  let mainTarget: Cents;                                     // total main-insurance amount owed for the month
  if (p.hasParallelSalariedEmployment) {
    mainTarget = p.efkaClassId === "special"
      ? cls("1")                                             // new professional with salaried job pays class 1 [S15]
      : Math.max(cls(p.efkaClassId), cls("2"));              // never below class 2 [S14]
  } else {
    mainTarget = cls(p.efkaClassId);
  }
  const offset = p.hasParallelSalariedEmployment ? p.salariedContributionsMonthlyMinor : 0;
  const main = Math.max(0, mainTarget - offset);             // [uncertain] see section 2.5
  const x = cfg.efka.extras;
  const sup  = x.supplementary.classes.find(c => c.id === p.supplementaryClass)?.monthlyMinor ?? 0;
  const lump = x.lumpSum.classes.find(c => c.id === p.lumpSumClass)?.monthlyMinor ?? 0;
  const extras = p.extrasCoveredBySalary ? 0
    : sup + lump + x.unemploymentMonthlyMinor + (p.healthProfessional ? x.healthProfessionalsHousingMonthlyMinor : 0);
  return main + extras;
}
// efkaAccrued_ytd(month m) = sum of efkaMonthly for months 1..m (accrual at month end).
// Per invoice, show "EFKA this invoice" only as an information line:
//   invoiceShare = rhu(efkaMonthly(m) * inv.netMinor, receiptsInMonth)  when the month has receipts.
// The reserve itself is driven by monthly accrual, not by invoice share.
// Cash view: EFKA for month m is paid by the due date (last working day of m+1 [uncertain]).
```

The special class applies only in the first five years of insurance; the app must ask for the insurance start year and switch off the special class when `year - startYear >= 5` (the rule: "until five years of insurance complete" [S13]).

### 7.6 Prepayment estimate

```ts
function prepaymentForNextYear(E, B_year, p, cfg): Cents {
  const taxTotal = totalIncomeTax(E, B_year, p, cfg);
  // business share: proportional (default) or marginal (config flag)
  const bizTax = cfg.prepayment.baseMethod === "proportionalShareOfTotalTax"
      ? rhu(taxTotal * B_year, E + B_year)
      : taxTotal - totalIncomeTax(E, 0, p, cfg);
  // exclude fees on which the client withheld 20% (art. 69 par. 5 (β)): scale bizTax by (B_without_withheld / B_year)
  const base = bizTax /* adjusted for excluded invoices */ - withheldTaxOnBusinessIncome;
  let pre = rhu(Math.max(0, base) * cfg.prepayment.rateBps, 10000);   // 55%
  if (p.firstTimeBusinessIncome) pre = rhu(pre * (10000 - cfg.prepayment.newProfessionalReductionBps), 10000); // half
  return pre < cfg.prepayment.minimumAssessedMinor ? 0 : pre;          // under 30.00 EUR: not assessed
}
```

Present it as "cash due with the return" (tax of the year minus withholdings and prepayment already paid, plus the prepayment for next year). It is not extra tax in the long run.

### 7.7 Withholding by clients

`withheldByClient = inv.clientWithheld20 && inv.netMinor > thresholdMinor ? rhu(inv.netMinor * 2000, 10000) : 0` (or the user's entered amount). It is credited at the year-end true-up. It does not reduce the reserve at invoice time (conservative). Show "cash you will actually receive = net + VAT - withheld".

### 7.8 Totals

```
Per invoice:  move to the tax-reserve bucket = vat + incomeTax   (EFKA is reserved monthly, see below)
Per month:    VAT of invoices + sum of reserve deltas of the month + EFKA accrued in the month (EFKA is a real monthly payment; reserve it monthly)
Per year:     VAT_year + (totalIncomeTax(E,B_year) - totalIncomeTax(E,0)) + EFKA_year
Year-end true-up: replace estimates with actuals; settle withheld tax; add next year's prepayment as a cash line.
```

Reserve rule for the bucket: move `vat + incomeTax` at invoice time and `EFKA` at month end. Do not move EFKA at invoice time (the monthly accrual avoids double counting).

### 7.9 Simplifications and what is [uncertain]

- The 1.3 proration of the art. 16 reduction, and the phase-out measured in proportion (not per full 1,000 EUR).
- Business losses are floored at zero; no carry-forward.
- Cash versus accrual: I assume receipts are recognised at the invoice date (simplified books); the books category and timing rules were not verified **[uncertain]**.
- No tax credits, deductions, living-cost presumptions, or minimum presumed income by default.
- The EFKA offset for parallel salaried employment is a user input; the rule is approximated as in 7.5.
- The VAT scheme test uses Greek turnover without VAT; the previous-year turnover is a user input.

## 8. Worked example (tax year 2026)

All figures use the algorithm of section 7 with integer cents and half-up rounding. They were computed with a script that implements section 7 and were checked to add up. They are an illustration of the method, not a prediction.

**Assumptions.**
- Tax year 2026. Employment taxable income `E` = 18,000.00 EUR. No dependent children. Age 31 or more (no age rate).
- Second year of the freelance activity (started in 2025). So: the special EFKA class is still allowed (first five years of insurance); the minimum presumed income does not apply (first three years); the first-band cut does not apply because gross receipts exceed 10,000 EUR; the prepayment for 2027 is not halved (the halving was for the first time business income was declared, in the 2025 return).
- 8 invoices of 1,500.00 EUR net (without VAT), issued mid-month from March to October. Total net 12,000.00 EUR. No business expenses. No input VAT. Clients do not withhold tax.
- VAT: case 1 normal regime at 24%. Case 2 small-business exemption, with Greek turnover of the previous year at or below 10,000 EUR.
- EFKA, scenario B (main, conservative): special class 150.46 EUR + 10.00 EUR unemployment = 160.46 EUR a month, 12 months = 1,925.52 EUR, with no offset for salaried contributions, no supplementary and no lump sum. EFKA scenario A (end of this section): the salaried job's contributions cover the freelance amount, so EFKA = 0 **[uncertain, section 2.5]**.

### Step 1: VAT

- Case 1 (normal): each invoice has VAT = 1,500.00 x 24% = 360.00 EUR. Year total = 8 x 360.00 = **2,880.00 EUR**. Invoiced gross = 14,880.00 EUR. Reserve the VAT at each invoice date.
- Case 2 (exemption): cumulative turnover is 1,500 / 3,000 / 4,500 / 6,000 / 7,500 / 9,000 after invoices 1 to 6, all without VAT. Invoice 7 (September) would bring turnover to 10,500.00 EUR, above 10,000.00 EUR, so it is invoiced with VAT in full: 360.00 EUR. Invoice 8 also carries 360.00 EUR. Year VAT = **720.00 EUR**. A declaration of changes is due within 30 days of invoice 7. From invoice 7 the person is in the normal regime (monthly or quarterly VAT returns), but with no right to deduct earlier input VAT.

### Step 2: EFKA

Monthly accrual 160.46 EUR. Year = 12 x 160.46 = **1,925.52 EUR**.

### Step 3: Net business income

B = 12,000.00 - 1,925.52 = **10,074.48 EUR**. Total taxable income S = 18,000.00 + 10,074.48 = **28,074.48 EUR**.

### Step 4: Income tax (2026 scale, no children)

- Tax on E alone: 10,000.00 x 9% = 900.00; 8,000.00 x 20% = 1,600.00; scale tax 2,500.00. Reduction (art. 16): 777.00 - 2% x (18,000.00 - 12,000.00) = 777.00 - 120.00 = 657.00. Tax on E alone = 2,500.00 - 657.00 = **1,843.00 EUR** (about what the employer withholds, an assumption).
- Tax on S: 10,000.00 x 9% = 900.00; 10,000.00 x 20% = 2,000.00; 8,074.48 x 26% = 2,099.36. Scale tax = **4,999.36 EUR**.
- Reduction prorated by the employment share: 657.00 x 18,000.00 / 28,074.48 = **421.24 EUR** [uncertain rule].
- Tax on S = 4,999.36 - 421.24 = **4,578.12 EUR**.
- Freelance income-tax reserve for the year = 4,578.12 - 1,843.00 = **2,735.12 EUR** (27.15% of the net business income).

Per month (a script computed these; the tax reserve moves up with each invoice and down a little as EFKA accrues):

| Month | Invoice net | VAT case 1 | VAT case 2 | Income-tax reserve from invoice | EFKA effect on reserve | EFKA accrued | Cumulative income-tax reserve |
|---|---|---|---|---|---|---|---|
| Jan | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 160.46 | 0.00 |
| Feb | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 160.46 | 0.00 |
| Mar | 1,500.00 | 360.00 | 0.00 | 276.21 | -37.30 | 160.46 | 238.91 |
| Apr | 1,500.00 | 360.00 | 0.00 | 376.58 | -46.27 | 160.46 | 569.22 |
| May | 1,500.00 | 360.00 | 0.00 | 429.87 | -45.72 | 160.46 | 953.37 |
| Jun | 1,500.00 | 360.00 | 0.00 | 425.24 | -45.27 | 160.46 | 1,333.34 |
| Jul | 1,500.00 | 360.00 | 0.00 | 421.38 | -44.89 | 160.46 | 1,709.83 |
| Aug | 1,500.00 | 360.00 | 0.00 | 418.12 | -44.57 | 160.46 | 2,083.38 |
| Sep | 1,500.00 | 360.00 | 360.00 | 415.34 | -44.30 | 160.46 | 2,454.42 |
| Oct | 1,500.00 | 360.00 | 360.00 | 412.96 | -44.06 | 160.46 | 2,823.32 |
| Nov | 0.00 | 0.00 | 0.00 | 0.00 | -44.08 | 160.46 | 2,779.24 |
| Dec | 0.00 | 0.00 | 0.00 | 0.00 | -44.12 | 160.46 | 2,735.12 |
| **Total** | **12,000.00** | **2,880.00** | **720.00** | **3,175.70** | **-440.58** | **1,925.52** | **2,735.12** |

(Jan and Feb EFKA accrue while there is no income yet; the loss is not carried, so the first invoice absorbs it. This is why the first invoice's reserve is lower than it would be with no EFKA.)

### Step 5: Prepayment for 2027 (assessed with the 2026 return)

- Business share of the tax (proportional method) = 4,578.12 x 10,074.48 / 28,074.48 = 1,642.85 EUR.
- Prepayment = 55% x 1,642.85 = **903.57 EUR** (full, not halved). With the marginal method it would be 55% x 2,735.12 = 1,504.32 EUR. **[uncertain which method]**
- It is not extra tax in the long run; it is cash due in 2027 with the 2026 return, credited against the 2027 tax.

### Step 6: Totals (scenario B)

| | Case 1: normal VAT | Case 2: small-business exemption |
|---|---|---|
| VAT | 2,880.00 | 720.00 |
| Income tax | 2,735.12 | 2,735.12 |
| EFKA | 1,925.52 | 1,925.52 |
| **Total to set aside** | **7,540.64** | **5,380.64** |
| As % of net invoices (12,000.00) | 62.8% | 44.8% |

Cash picture in July 2027 for the tax: 2,735.12 (the freelance tax) + 903.57 (prepayment for 2027) = 3,638.69 EUR, less any prepayment for 2026 that was assessed with the 2025 return (input), assuming the employer's payroll withholding equals the tax on the salary alone (1,843.00). This is paid in 8 monthly instalments from the end of July 2027 (expected, section 6).

### Scenario A: EFKA covered by the salaried job (EFKA = 0)

B = 12,000.00. S = 30,000.00. Scale tax: 10,000 at 9% = 900.00; 10,000 at 20% = 2,000.00; 10,000 at 26% = 2,600.00; scale tax = 5,500.00. Reduction = 657.00 x 18,000.00 / 30,000.00 = 394.20. Tax = 5,105.80. Freelance income-tax reserve = 5,105.80 - 1,843.00 = **3,262.80 EUR**. Totals: case 1 = 2,880.00 + 3,262.80 + 0.00 = **6,142.80** (51.2%); case 2 = 720.00 + 3,262.80 = **3,982.80** (33.2%). Prepayment (proportional) = 55% x (5,105.80 x 12,000 / 30,000 = 2,042.32) = 1,123.28 EUR.

The case 1 total is 1,397.84 EUR lower in A than in B: the EFKA of 1,925.52 EUR is not paid, but the income-tax reserve is 527.68 EUR higher because the EFKA deduction is lost. The EFKA amount is the main driver, so the parallel-insurance rule needs an accountant's confirmation.

## 9. JSON config

One block per tax year. Money is integer euro cents, rates are basis points. Every block points to a source (`sourceId`, listed in `sources`) and carries `uncertain`. `upToMinor: null` means "no upper limit". `lastReviewed` is the date this file was written. When a figure is `uncertain: true`, the UI should show an "[uncertain]" tag next to it. Sources ids refer to the register in section 0.

Notes on the schema:
- `incomeTax.employmentReduction` is the art. 16 reduction; `appliesToBusinessIncome: false` and the proration setting implement section 1.3.
- `efka.classes[].monthlyMinor` is the sum of the three parts; the unemployment 10.00 EUR and the other extras are in `efka.extras`.
- `efka.parallelSalariedEmployment` holds the floors of section 2.5; `salariedContributionsMonthlyMinorUserInput` says the offset is entered by the user.
- `prepayment.reductionYears` is 1: the reduction applies only the first time business income is declared (section 4).
- For tax year 2025 the EFKA special-class and parallel-employment rules were read only in the 2026 pages, so the 2025 block marks them uncertain.

### 9.1 Tax year 2025

```json
{
  "taxYear": 2025,
  "lastReviewed": "2026-10-22",
  "sources": [
    {
      "id": "S1",
      "title": "Law 5246/2025, ΦΕΚ Α΄ 198/11.11.2025 (tax reform for demography and the middle class)",
      "url": "https://www.aade.gr/sites/default/files/2025-11/%CE%91%CE%A0%CE%9F%CE%A3%CE%A0%CE%91%CE%A3%CE%9C%CE%91%20%CE%A6%CE%95%CE%9A%20%CE%91%20198_2025%20%CE%9D%205246_2025.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S2",
      "title": "AADE Q&A manual on tax matters, May 2026 (tax year 2025 incomes)",
      "url": "https://www.aade.gr/sites/default/files/2026-05/egxeiridio_erotiseon_apantiseon_forologias_may_2026.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S3",
      "title": "AADE instructions for form E1, tax year 2025 (16 March 2026)",
      "url": "https://www.aade.gr/sites/default/files/2026-03/Odigies_E1_2026_0.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S4",
      "title": "AADE instructions for form E3, tax year 2025 (13 March 2026)",
      "url": "https://www.aade.gr/sites/default/files/2026-03/odigies_E3_FE_2025.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S5",
      "title": "Income Tax Code (ν. 4172/2013), administrative codification published by the Ministry of Finance, May 2024 (arts 16, 22, 28A, 29, 43A, 61, 62, 64, 69, 70)",
      "url": "https://minfin.gov.gr/wp-content/uploads/2024/05/%CE%A195%CE%A6%CE%97-59%CE%93_%CE%94%CE%B9%CE%BF%CE%B9%CE%BA%CE%B7%CF%84%CE%B9%CE%BA%CE%AE-%CE%9A%CF%89%CE%B4%CE%B9%CE%BA%CE%BF%CF%80%CE%BF%CE%AF%CE%B7%CF%83%CE%B7-%CE%9A%CF%8E%CE%B4%CE%B9%CE%BA%CE%B1-%CE%A6%CE%BF%CF%81%CE%BF%CE%BB%CE%BF%CE%B3%CE%AF%CE%B1%CF%82-%CE%95%CE%B9%CF%83%CE%BF%CE%B4%CE%AE%CE%BC%CE%B1%CF%84%CE%BF%CF%82.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S6",
      "title": "Law 5162/2024, ΦΕΚ Α΄ 198/05.12.2024 (art. 3 tax on professional activity abolished for individuals; art. 6 minimum income)",
      "url": "https://www.aade.gr/sites/default/files/2024-12/%CE%9D%205162%202024%20%CE%A6%CE%95%CE%9A%20198.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S7",
      "title": "AADE guide for persons with disability, Oct 2023 (note on solidarity contribution)",
      "url": "https://www.aade.gr/sites/default/files/2024-03/xristik_odig_AMEA.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S8",
      "title": "AADE FAQ on withholding-fee certificates for tax year 2025 (19 Jan 2026)",
      "url": "https://www.aade.gr/sites/default/files/2026-01/FAQs_vev_amoiv_epixeirimat_2025.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S9",
      "title": "AADE FAQ on withholding returns (19 Apr 2021), item 9 on εργόσημο",
      "url": "https://www.aade.gr/sites/default/files/2021-04/FAQs_paraktratoumenoi_fmy_19_4_21.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S10",
      "title": "e-EFKA circular 2/2025 (contributions 2025, non-salaried)",
      "url": "https://e-efka.gov.gr/sites/default/files/2025-01/%CE%95%CE%B3%CE%BA%CF%8D%CE%BA%CE%BB%CE%B9%CE%BF%CF%82%202-2025.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S13",
      "title": "e-EFKA page: new freelancers (special class, 2026)",
      "url": "https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/neoi-epaggelmaties",
      "read": "2026-10-22"
    },
    {
      "id": "S14",
      "title": "e-EFKA page: parallel insurance, case 1 (freelancer + salaried job)",
      "url": "https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/parallhlh-asfalish/Periptosh-proth",
      "read": "2026-10-22"
    },
    {
      "id": "S15",
      "title": "e-EFKA page: parallel insurance, new freelancer + salaried job",
      "url": "https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/parallhlh-asfalish/Periptosh-trith",
      "read": "2026-10-22"
    },
    {
      "id": "S17",
      "title": "e-EFKA FAQ: contributions of freelancers, self-employed and farmers",
      "url": "https://www.e-efka.gov.gr/el/sychnes-eroteseis/asphalisi-eisphores/asphalismenoi/me-misthotoi-0/nees-eisphores-apo-112020/nees-eisphores-eleytheron-epaggelmation-aytotelos-apascholoymenon-kai-agroton",
      "read": "2026-10-22"
    },
    {
      "id": "S19",
      "title": "VAT Code (ν. 5144/2024), AADE consolidated text up to 31.12.2024 (arts 26, 43, 44)",
      "url": "https://www.aade.gr/sites/default/files/2025-05/kodikas_fpa_n.5144_2024%20kodikopoiisi_eniaio_keimeno%20@%20eos%2031.12.2024_0.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S21",
      "title": "AADE FAQ on the small-business VAT scheme, 30 Dec 2025",
      "url": "https://www.aade.gr/sites/default/files/2026-01/FAQs_eidiko_kathestos_mikrwn_epixeir.pdf",
      "read": "2026-10-22"
    }
  ],
  "incomeTax": {
    "bands": [
      {
        "upToMinor": 1000000,
        "rateBps": 900
      },
      {
        "upToMinor": 2000000,
        "rateBps": 2200
      },
      {
        "upToMinor": 3000000,
        "rateBps": 2800
      },
      {
        "upToMinor": 4000000,
        "rateBps": 3600
      },
      {
        "upToMinor": null,
        "rateBps": 4400
      }
    ],
    "sourceId": "S2",
    "uncertain": false,
    "dependentChildrenRates": null,
    "ageRates": null,
    "employmentReduction": {
      "baseByChildrenMinor": [
        77700,
        90000,
        112000,
        134000,
        158000,
        178000
      ],
      "extraChildMinor": 22000,
      "phaseOutStartMinor": 1200000,
      "phaseOutBpsOfIncomeOverStart": 200,
      "appliesToBusinessIncome": false,
      "mixedIncomeProration": "employmentShareOfTotalTaxableIncome",
      "sourceId": "S2",
      "uncertain": true
    }
  },
  "efka": {
    "classes": [
      {
        "id": "1",
        "monthlyMinor": 24465,
        "parts": {
          "pensionMinor": 18058,
          "healthCashMinor": 582,
          "healthInKindMinor": 5825
        }
      },
      {
        "id": "2",
        "monthlyMinor": 29359,
        "parts": {
          "pensionMinor": 21670,
          "healthCashMinor": 699,
          "healthInKindMinor": 6990
        }
      },
      {
        "id": "3",
        "monthlyMinor": 35184,
        "parts": {
          "pensionMinor": 27495,
          "healthCashMinor": 699,
          "healthInKindMinor": 6990
        }
      },
      {
        "id": "4",
        "monthlyMinor": 42290,
        "parts": {
          "pensionMinor": 34601,
          "healthCashMinor": 699,
          "healthInKindMinor": 6990
        }
      },
      {
        "id": "5",
        "monthlyMinor": 50678,
        "parts": {
          "pensionMinor": 42989,
          "healthCashMinor": 699,
          "healthInKindMinor": 6990
        }
      },
      {
        "id": "6",
        "monthlyMinor": 65939,
        "parts": {
          "pensionMinor": 58250,
          "healthCashMinor": 699,
          "healthInKindMinor": 6990
        }
      },
      {
        "id": "special",
        "monthlyMinor": 14679,
        "parts": {
          "pensionMinor": 10835,
          "healthCashMinor": 349,
          "healthInKindMinor": 3495
        }
      }
    ],
    "defaultClassId": "1",
    "newProfessional": {
      "classId": "special",
      "maxYearsOfInsurance": 5,
      "notAvailableWithSeveralNonSalariedActivities": true,
      "notAvailableAgainAfterInterruption": true,
      "sourceId": "S10",
      "uncertain": true
    },
    "parallelSalariedEmployment": {
      "standardMinimumClassId": "2",
      "newProfessionalPaysClassId": "1",
      "salariedContributionsAreSubtracted": true,
      "salariedContributionsMonthlyMinorUserInput": true,
      "sourceId": "S14",
      "uncertain": true
    },
    "extras": {
      "supplementary": {
        "appliesDefault": true,
        "classes": [
          {
            "id": "1",
            "monthlyMinor": 4543
          },
          {
            "id": "2",
            "monthlyMinor": 5476
          },
          {
            "id": "3",
            "monthlyMinor": 6525
          }
        ],
        "uncertain": true
      },
      "lumpSum": {
        "appliesDefault": true,
        "classes": [
          {
            "id": "1",
            "monthlyMinor": 3029
          },
          {
            "id": "2",
            "monthlyMinor": 3612
          },
          {
            "id": "3",
            "monthlyMinor": 4310
          }
        ],
        "uncertain": true
      },
      "unemploymentMonthlyMinor": 1000,
      "healthProfessionalsHousingMonthlyMinor": 200,
      "extrasCollectedOnlyIfNotPaidViaSalary": true
    },
    "classChoiceDeadline": null,
    "ifNoChoiceKeepPreviousClass": true,
    "dueRule": {
      "type": "lastWorkingDayOfNextMonth",
      "uncertain": true
    },
    "deductibleFromBusinessIncome": true,
    "sourceId": "S10",
    "uncertain": true
  },
  "vat": {
    "standardRateBps": 2400,
    "reducedRatesBps": [
      1300,
      600,
      400
    ],
    "smallBusinessThresholdMinor": 1000000,
    "smallBusinessThresholdTest": "Greek turnover (without VAT) in both the previous and the current calendar year",
    "smallBusinessCrossingRule": "VAT applies from the invoice that crosses the threshold, for its full value",
    "smallBusinessInvoiceWording": "Χωρίς Φόρο Προστιθέμενης Αξίας - Απαλλαγή μικρών επιχειρήσεων",
    "smallBusinessInputVatDeductible": false,
    "euSme": {
      "unionThresholdMinor": 10000000,
      "maxNationalThresholdMinor": 8500000,
      "note": "Cross-border scheme from 2025-01-01, VAT Code arts 44β and 44γ; not used by the estimator"
    },
    "filing": {
      "normalBooks": "monthly",
      "simplifiedBooks": "quarterly",
      "dueRule": "lastWorkingDayOfNextMonth",
      "twoInterestFreeInstalmentsAboveMinor": 10000,
      "carryOverUpToMinor": 3000
    },
    "sourceId": "S19",
    "uncertain": false
  },
  "prepayment": {
    "rateBps": 5500,
    "newProfessionalReductionBps": 5000,
    "reductionYears": 1,
    "reductionAppliesTo": "first time business income is declared",
    "minimumAssessedMinor": 3000,
    "excludesIncomeWithheldUnderArt64Delta": true,
    "baseMethod": "proportionalShareOfTotalTax",
    "alternativeBaseMethod": "marginalTax",
    "sourceId": "S5",
    "uncertain": true
  },
  "withholding": {
    "rateBps": 2000,
    "appliesTo": "fees for technical, management, consulting and similar services paid to natural persons by businesses and legal entities",
    "thresholdMinor": 30000,
    "thresholdRule": "withheld only if the transaction exceeds the threshold (Greek tax resident recipient)",
    "baseExcludesVat": true,
    "creditedAgainstFinalTax": true,
    "exhaustsTax": false,
    "generalGovernment": {
      "servicesRateBps": 800,
      "goodsRateBps": 400,
      "fuelAndTobaccoRateBps": 100,
      "exemptBelowNetPerTransactionMinor": 15000
    },
    "sourceId": "S5",
    "uncertain": true
  },
  "other": {
    "solidarityContribution": {
      "applies": false,
      "note": "Abolished for all income obtained from 2023-01-01 (law 4972/2022 art. 177, as stated by AADE).",
      "sourceId": "S7",
      "uncertain": false
    },
    "professionalFee": {
      "applies": false,
      "note": "Abolished for natural persons from tax year 2024 (law 5162/2024 art. 3).",
      "sourceId": "S6",
      "uncertain": false
    },
    "ergosimo": {
      "incomeTaxWithheldAtRedemption": false,
      "taxedAs": "employment_income",
      "amountToDeclare": "face value minus insurance contributions, as printed on the voucher",
      "sourceId": "S3",
      "uncertain": false
    },
    "minimumPresumedIncome": {
      "enabledByDefault": false,
      "exemptYearsFromFirstStart": 3,
      "year4": "minimum reduced by 2/3 (wording ambiguous)",
      "year5": "minimum reduced by 1/3",
      "maxMinor": 5000000,
      "basis": "annual gross legal minimum wage with 10% step-ups per three-year period, plus staff and turnover add-ons",
      "userMustProvideMinimumWageMinor": true,
      "sourceId": "S1",
      "uncertain": true
    },
    "newSoleProprietorFirstBandCut": {
      "defaultEnabled": false,
      "cutBps": 5000,
      "years": 3,
      "maxGrossBusinessIncomeMinor": 1000000,
      "sourceId": "S5",
      "uncertain": true
    },
    "calendar": {
      "returnWindow": "2026-03-16..2026-07-15",
      "instalments": 8,
      "firstInstalment": "2026-07-31",
      "earlyPaymentDiscountBps": {
        "fileByMay15": 400,
        "fileByJun15": 300,
        "fileByJul15": 200
      },
      "sourceId": "S2",
      "uncertain": false
    }
  }
}
```

### 9.2 Tax year 2026

```json
{
  "taxYear": 2026,
  "lastReviewed": "2026-10-22",
  "sources": [
    {
      "id": "S1",
      "title": "Law 5246/2025, ΦΕΚ Α΄ 198/11.11.2025 (tax reform for demography and the middle class)",
      "url": "https://www.aade.gr/sites/default/files/2025-11/%CE%91%CE%A0%CE%9F%CE%A3%CE%A0%CE%91%CE%A3%CE%9C%CE%91%20%CE%A6%CE%95%CE%9A%20%CE%91%20198_2025%20%CE%9D%205246_2025.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S2",
      "title": "AADE Q&A manual on tax matters, May 2026 (tax year 2025 incomes)",
      "url": "https://www.aade.gr/sites/default/files/2026-05/egxeiridio_erotiseon_apantiseon_forologias_may_2026.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S3",
      "title": "AADE instructions for form E1, tax year 2025 (16 March 2026)",
      "url": "https://www.aade.gr/sites/default/files/2026-03/Odigies_E1_2026_0.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S4",
      "title": "AADE instructions for form E3, tax year 2025 (13 March 2026)",
      "url": "https://www.aade.gr/sites/default/files/2026-03/odigies_E3_FE_2025.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S5",
      "title": "Income Tax Code (ν. 4172/2013), administrative codification published by the Ministry of Finance, May 2024 (arts 16, 22, 28A, 29, 43A, 61, 62, 64, 69, 70)",
      "url": "https://minfin.gov.gr/wp-content/uploads/2024/05/%CE%A195%CE%A6%CE%97-59%CE%93_%CE%94%CE%B9%CE%BF%CE%B9%CE%BA%CE%B7%CF%84%CE%B9%CE%BA%CE%AE-%CE%9A%CF%89%CE%B4%CE%B9%CE%BA%CE%BF%CF%80%CE%BF%CE%AF%CE%B7%CF%83%CE%B7-%CE%9A%CF%8E%CE%B4%CE%B9%CE%BA%CE%B1-%CE%A6%CE%BF%CF%81%CE%BF%CE%BB%CE%BF%CE%B3%CE%AF%CE%B1%CF%82-%CE%95%CE%B9%CF%83%CE%BF%CE%B4%CE%AE%CE%BC%CE%B1%CF%84%CE%BF%CF%82.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S6",
      "title": "Law 5162/2024, ΦΕΚ Α΄ 198/05.12.2024 (art. 3 tax on professional activity abolished for individuals; art. 6 minimum income)",
      "url": "https://www.aade.gr/sites/default/files/2024-12/%CE%9D%205162%202024%20%CE%A6%CE%95%CE%9A%20198.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S7",
      "title": "AADE guide for persons with disability, Oct 2023 (note on solidarity contribution)",
      "url": "https://www.aade.gr/sites/default/files/2024-03/xristik_odig_AMEA.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S8",
      "title": "AADE FAQ on withholding-fee certificates for tax year 2025 (19 Jan 2026)",
      "url": "https://www.aade.gr/sites/default/files/2026-01/FAQs_vev_amoiv_epixeirimat_2025.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S9",
      "title": "AADE FAQ on withholding returns (19 Apr 2021), item 9 on εργόσημο",
      "url": "https://www.aade.gr/sites/default/files/2021-04/FAQs_paraktratoumenoi_fmy_19_4_21.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S11",
      "title": "e-EFKA circular 6/2026 (contributions 2026, non-salaried)",
      "url": "https://www.e-efka.gov.gr/sites/default/files/2026-02/%CE%91%CF%83%CF%86%CE%B1%CE%BB%CE%B9%CF%83%CF%84%CE%B9%CE%BA%CE%AD%CF%82_%CE%B5%CE%B9%CF%83%CF%86%CE%BF%CF%81%CE%AD%CF%82_%CE%AD%CF%84%CE%BF%CF%85%CF%82_2026_%CE%BC%CE%B7_%CE%BC%CE%B9%CF%83%CE%B8%CF%89%CF%84%CF%8E%CE%BD_%CE%95%CE%BB%CE%B5%CF%85%CE%B8%CE%AD%CF%81%CF%89%CE%BD_%CE%95%CF%80%CE%B1%CE%B3%CE%B3%CE%B5%CE%BB%CE%BC%CE%B1%CF%84%CE%B9%CF%8E%CE%BD_%CE%91%CF%85%CF%84%CE%BF%CE%B1%CF%80%CE%B1%CF%83%CF%87%CE%BF%CE%BB%CE%BF%CF%8D%CE%BC%CE%B5%CE%BD%CF%89%CE%BD_%CE%91%CE%B3%CF%81%CE%BF%CF%84%CF%8E%CE%BD_V1.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S12",
      "title": "e-EFKA page: freelancers and self-employed (2026 classes)",
      "url": "https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/eleftheroi-epaggelmaties-aftoapasxoloumenoi",
      "read": "2026-10-22"
    },
    {
      "id": "S13",
      "title": "e-EFKA page: new freelancers (special class, 2026)",
      "url": "https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/neoi-epaggelmaties",
      "read": "2026-10-22"
    },
    {
      "id": "S14",
      "title": "e-EFKA page: parallel insurance, case 1 (freelancer + salaried job)",
      "url": "https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/parallhlh-asfalish/Periptosh-proth",
      "read": "2026-10-22"
    },
    {
      "id": "S15",
      "title": "e-EFKA page: parallel insurance, new freelancer + salaried job",
      "url": "https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/parallhlh-asfalish/Periptosh-trith",
      "read": "2026-10-22"
    },
    {
      "id": "S16",
      "title": "e-EFKA FAQ: insurance and contributions",
      "url": "https://www.e-efka.gov.gr/el/sychnes-eroteseis/sychnes-eroteseis-kai-apanteseis/asphalise-eisphores",
      "read": "2026-10-22"
    },
    {
      "id": "S17",
      "title": "e-EFKA FAQ: contributions of freelancers, self-employed and farmers",
      "url": "https://www.e-efka.gov.gr/el/sychnes-eroteseis/asphalisi-eisphores/asphalismenoi/me-misthotoi-0/nees-eisphores-apo-112020/nees-eisphores-eleytheron-epaggelmation-aytotelos-apascholoymenon-kai-agroton",
      "read": "2026-10-22"
    },
    {
      "id": "S18",
      "title": "e-EFKA FAQ: εργόσημο (former IKA-ETAM)",
      "url": "https://www.e-efka.gov.gr/el/sychnes-eroteseis/asphalisi-eisphores/asphalismenoi/ergosemo/ergosemo-t-ika-etam",
      "read": "2026-10-22"
    },
    {
      "id": "S19",
      "title": "VAT Code (ν. 5144/2024), AADE consolidated text up to 31.12.2024 (arts 26, 43, 44)",
      "url": "https://www.aade.gr/sites/default/files/2025-05/kodikas_fpa_n.5144_2024%20kodikopoiisi_eniaio_keimeno%20@%20eos%2031.12.2024_0.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S20",
      "title": "AADE guide to the EU small-business VAT scheme, 29 Jan 2026",
      "url": "https://www.aade.gr/sites/default/files/2026-01/odigos_mikr_epixeiriseon.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S21",
      "title": "AADE FAQ on the small-business VAT scheme, 30 Dec 2025",
      "url": "https://www.aade.gr/sites/default/files/2026-01/FAQs_eidiko_kathestos_mikrwn_epixeir.pdf",
      "read": "2026-10-22"
    },
    {
      "id": "S22",
      "title": "e-EFKA page: parallel insurance (index of the five cases)",
      "url": "https://www.e-efka.gov.gr/el/asphalismenoi/me-misthotoi/neo-systhma-asfalistikon-eisforon/parallhlh-asfalish",
      "read": "2026-10-22"
    }
  ],
  "incomeTax": {
    "bands": [
      {
        "upToMinor": 1000000,
        "rateBps": 900
      },
      {
        "upToMinor": 2000000,
        "rateBps": 2000
      },
      {
        "upToMinor": 3000000,
        "rateBps": 2600
      },
      {
        "upToMinor": 4000000,
        "rateBps": 3400
      },
      {
        "upToMinor": 6000000,
        "rateBps": 3900
      },
      {
        "upToMinor": null,
        "rateBps": 4400
      }
    ],
    "sourceId": "S1",
    "uncertain": false,
    "dependentChildrenRates": {
      "band2RateBpsByChildren": [
        2000,
        1800,
        1600,
        900
      ],
      "band3RateBpsByChildren": [
        2600,
        2400,
        2200,
        2000,
        1800
      ],
      "band3ExtraChildReductionBpsAbove4": 200,
      "fourOrMoreChildrenBand1And2RateBps": 0,
      "sourceId": "S1",
      "uncertain": true
    },
    "ageRates": {
      "upToIncomeMinor": 2000000,
      "ageUpTo25RateBps": 0,
      "age26To30RateBps": 900,
      "appliesToFirstTwoBands": true,
      "sourceId": "S1",
      "uncertain": true
    },
    "employmentReduction": {
      "baseByChildrenMinor": [
        77700,
        90000,
        112000,
        134000,
        158000,
        178000
      ],
      "extraChildMinor": 22000,
      "phaseOutStartMinor": 1200000,
      "phaseOutBpsOfIncomeOverStart": 200,
      "appliesToBusinessIncome": false,
      "mixedIncomeProration": "employmentShareOfTotalTaxableIncome",
      "sourceId": "S2",
      "uncertain": true
    }
  },
  "efka": {
    "classes": [
      {
        "id": "1",
        "monthlyMinor": 25077,
        "parts": {
          "pensionMinor": 18509,
          "healthCashMinor": 597,
          "healthInKindMinor": 5971
        }
      },
      {
        "id": "2",
        "monthlyMinor": 30093,
        "parts": {
          "pensionMinor": 22212,
          "healthCashMinor": 716,
          "healthInKindMinor": 7165
        }
      },
      {
        "id": "3",
        "monthlyMinor": 36063,
        "parts": {
          "pensionMinor": 28182,
          "healthCashMinor": 716,
          "healthInKindMinor": 7165
        }
      },
      {
        "id": "4",
        "monthlyMinor": 43347,
        "parts": {
          "pensionMinor": 35466,
          "healthCashMinor": 716,
          "healthInKindMinor": 7165
        }
      },
      {
        "id": "5",
        "monthlyMinor": 51945,
        "parts": {
          "pensionMinor": 44064,
          "healthCashMinor": 716,
          "healthInKindMinor": 7165
        }
      },
      {
        "id": "6",
        "monthlyMinor": 67587,
        "parts": {
          "pensionMinor": 59706,
          "healthCashMinor": 716,
          "healthInKindMinor": 7165
        }
      },
      {
        "id": "special",
        "monthlyMinor": 15046,
        "parts": {
          "pensionMinor": 11106,
          "healthCashMinor": 358,
          "healthInKindMinor": 3582
        }
      }
    ],
    "defaultClassId": "1",
    "newProfessional": {
      "classId": "special",
      "maxYearsOfInsurance": 5,
      "notAvailableWithSeveralNonSalariedActivities": true,
      "notAvailableAgainAfterInterruption": true,
      "sourceId": "S13",
      "uncertain": false
    },
    "parallelSalariedEmployment": {
      "standardMinimumClassId": "2",
      "newProfessionalPaysClassId": "1",
      "salariedContributionsAreSubtracted": true,
      "salariedContributionsMonthlyMinorUserInput": true,
      "sourceId": "S14",
      "uncertain": true
    },
    "extras": {
      "supplementary": {
        "appliesDefault": true,
        "classes": [
          {
            "id": "1",
            "monthlyMinor": 4657
          },
          {
            "id": "2",
            "monthlyMinor": 5613
          },
          {
            "id": "3",
            "monthlyMinor": 6688
          }
        ],
        "uncertain": true
      },
      "lumpSum": {
        "appliesDefault": true,
        "classes": [
          {
            "id": "1",
            "monthlyMinor": 3105
          },
          {
            "id": "2",
            "monthlyMinor": 3702
          },
          {
            "id": "3",
            "monthlyMinor": 4418
          }
        ],
        "uncertain": true
      },
      "unemploymentMonthlyMinor": 1000,
      "healthProfessionalsHousingMonthlyMinor": 200,
      "extrasCollectedOnlyIfNotPaidViaSalary": true
    },
    "classChoiceDeadline": "2026-01-31",
    "ifNoChoiceKeepPreviousClass": true,
    "dueRule": {
      "type": "lastWorkingDayOfNextMonth",
      "uncertain": true
    },
    "deductibleFromBusinessIncome": true,
    "sourceId": "S11",
    "uncertain": false
  },
  "vat": {
    "standardRateBps": 2400,
    "reducedRatesBps": [
      1300,
      600,
      400
    ],
    "smallBusinessThresholdMinor": 1000000,
    "smallBusinessThresholdTest": "Greek turnover (without VAT) in both the previous and the current calendar year",
    "smallBusinessCrossingRule": "VAT applies from the invoice that crosses the threshold, for its full value",
    "smallBusinessInvoiceWording": "Χωρίς Φόρο Προστιθέμενης Αξίας - Απαλλαγή μικρών επιχειρήσεων",
    "smallBusinessInputVatDeductible": false,
    "euSme": {
      "unionThresholdMinor": 10000000,
      "maxNationalThresholdMinor": 8500000,
      "note": "Cross-border scheme from 2025-01-01, VAT Code arts 44β and 44γ; not used by the estimator"
    },
    "filing": {
      "normalBooks": "monthly",
      "simplifiedBooks": "quarterly",
      "dueRule": "lastWorkingDayOfNextMonth",
      "twoInterestFreeInstalmentsAboveMinor": 10000,
      "carryOverUpToMinor": 3000
    },
    "sourceId": "S19",
    "uncertain": false
  },
  "prepayment": {
    "rateBps": 5500,
    "newProfessionalReductionBps": 5000,
    "reductionYears": 1,
    "reductionAppliesTo": "first time business income is declared",
    "minimumAssessedMinor": 3000,
    "excludesIncomeWithheldUnderArt64Delta": true,
    "baseMethod": "proportionalShareOfTotalTax",
    "alternativeBaseMethod": "marginalTax",
    "sourceId": "S5",
    "uncertain": true
  },
  "withholding": {
    "rateBps": 2000,
    "appliesTo": "fees for technical, management, consulting and similar services paid to natural persons by businesses and legal entities",
    "thresholdMinor": 30000,
    "thresholdRule": "withheld only if the transaction exceeds the threshold (Greek tax resident recipient)",
    "baseExcludesVat": true,
    "creditedAgainstFinalTax": true,
    "exhaustsTax": false,
    "generalGovernment": {
      "servicesRateBps": 800,
      "goodsRateBps": 400,
      "fuelAndTobaccoRateBps": 100,
      "exemptBelowNetPerTransactionMinor": 15000
    },
    "sourceId": "S5",
    "uncertain": true
  },
  "other": {
    "solidarityContribution": {
      "applies": false,
      "note": "Abolished for all income obtained from 2023-01-01 (law 4972/2022 art. 177, as stated by AADE).",
      "sourceId": "S7",
      "uncertain": false
    },
    "professionalFee": {
      "applies": false,
      "note": "Abolished for natural persons from tax year 2024 (law 5162/2024 art. 3).",
      "sourceId": "S6",
      "uncertain": false
    },
    "ergosimo": {
      "incomeTaxWithheldAtRedemption": false,
      "taxedAs": "employment_income",
      "amountToDeclare": "face value minus insurance contributions, as printed on the voucher",
      "sourceId": "S3",
      "uncertain": false
    },
    "minimumPresumedIncome": {
      "enabledByDefault": false,
      "exemptYearsFromFirstStart": 3,
      "year4": "minimum reduced by 2/3 (wording ambiguous)",
      "year5": "minimum reduced by 1/3",
      "maxMinor": 5000000,
      "basis": "annual gross legal minimum wage with 10% step-ups per three-year period, plus staff and turnover add-ons",
      "userMustProvideMinimumWageMinor": true,
      "sourceId": "S1",
      "uncertain": true
    },
    "newSoleProprietorFirstBandCut": {
      "defaultEnabled": false,
      "cutBps": 5000,
      "years": 3,
      "maxGrossBusinessIncomeMinor": 1000000,
      "sourceId": "S5",
      "uncertain": true
    },
    "calendar": {
      "returnWindow": "not published yet (expected mid-March to mid-July 2027)",
      "instalments": 8,
      "firstInstalment": null,
      "earlyPaymentDiscountBps": {
        "fileByMay15": 400,
        "fileByJun15": 300,
        "fileByJul15": 200
      },
      "sourceId": "S2",
      "uncertain": true
    }
  }
}
```

## 10. [uncertain] list and open questions for an accountant

Items tagged [uncertain] in this file. Each says what is missing.

**Income tax**
1. Art. 16 reduction in a mixed employment plus business case: the sources say the reductions "do not apply" to business profit and, for farmers, that the reduction is prorated to the employment part. The proration `R * E / (E + B)` and the proportional phase-out are my reading (section 1.3). Missing: an AADE worked example or the text of art. 16 par. 1 as in force. Maximum effect 777 EUR for no children.
2. The 2026 amounts of the art. 16 reduction (777 and so on): law 5246/2025 does not change art. 16, but I did not open a 2026 document that restates them.
3. Child and age rates of the 2026 scale: do they apply to business profit stacked with employment income, and which date fixes the age (section 1.2)?
4. First-band 50% cut for new sole proprietors (art. 29 par. 2): start-date wording differs (2013 in the Code, 2023 in the E1 instructions), and the mechanics with employment income in the first band are not explained (section 1.5).
5. Minimum presumed income: the 2026 annual gross minimum wage was not found in an official page; "reduced by 2/3 / 1/3" in years 4 and 5 is ambiguous; whether it applies to every sole freelancer on simplified books (section 1.6).
6. Tax year 2026 prepayment rate 55% and the first-time half reduction: confirmed in sources for the 2025 return; no 2026 amendment seen, not independently confirmed for 2026.
7. How the tax "from business activity" is split when employment income exists (proportional or marginal), for the prepayment (section 4).
8. Whether the prepayment is paid in the same eight instalments as the tax (section 4).
9. Cash versus accrual recognition of receipts for a freelancer on simplified books.

**EFKA**
10. Legal due date of the monthly contribution (assumed last working day of the following month) (section 2.6).
11. Parallel insurance: which salaried contributions are subtracted, month by month or yearly, and the exact floors (1st class for new professionals, 2nd class for others). e-EFKA general FAQ and the case pages are consistent but do not give a worked example (section 2.5).
12. Whether contributions paid through εργόσημο count as "paid through salaried work" for the offset.
13. When supplementary (επικουρική) and lump-sum (εφάπαξ) insurance apply to a person (the pages say "if entitled").
14. Default class if no choice is made: the 2026 pages say the previous class continues; an older FAQ says the 1st class (section 2.3).
15. The 2025 parallel-insurance and special-class rules: I read the pages for 2026 only; the 2025 amounts are from circular 2/2025.
16. Registration deadline "10th of the month after the start of activity": found only in a search summary.
17. The reading of the special class's five-year limit when the person has insurance years from before the freelance activity.
18. The εργόσημο contribution rates: the e-EFKA page's 25% and the 11.63 divisor do not reconcile.

**VAT**
19. Annex III (reduced-rate list): not read, so I cannot say which services are at 13% or 6%.
20. Whether a freelancer's books category is simplified (quarterly VAT) or double-entry (monthly VAT).
21. Whether services billed to clients in other EU countries count in the 10,000 EUR domestic turnover (they are taxed at the client's place; I did not read the text).
22. Exact current article numbers: the scheme is art. 44α in the current Code, but I only had the text consolidated to 31.12.2024 (art. 44).

**Withholding**
23. Which freelance services count as "technical, management, consulting or similar" fees for the 20% withholding (circular ΠΟΛ.1120/2014 not opened), and whether the 20% base excludes VAT.
24. Whether the 20% applies below 300 EUR in some payer categories (the FAQ item 13 refers to special payer categories).

**Calendar**
25. Dates for the 2026 tax-year return and instalments (not published yet; assumed same pattern as 2025).

**General**
26. Items outside the scope of this file and not modelled: tax credits, deductions, living-cost presumptions (τεκμήρια), losses carried forward, other EFKA branches.

