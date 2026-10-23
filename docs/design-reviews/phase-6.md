# Design review: Phase 6 (2026-10-23)

New: the investing module (`/investing`, `/investing/suggestion`, `/investing/watchlist`, `/investing/profile`),
shown only while the module is on. Impeccable `shape` ran on the existing direction contract (Operate mode, Athens
Metro world); the discovery interview was answered from the brief because the run is hands-off.

- Tour: 5 new screens × 375/1440 × light/dark (ranking, suggestion, watchlist, profile, add-instrument sheet);
  axe-core **0 violations**; detector 0 findings. The tour also checks that `/investing` is 404 and the nav has no
  investing entry while the module is off.
- Every view opens with the investing disclaimer, then one line with the newest price date, the ECB rate date and a
  stale count (warning icon plus words). Rows, not cards: rank, ticker with exchange and currency, name, 12-month
  return, volatility and TER, source and date, price in EUR with the trading-currency price beneath, and the score.
  "How this score was built" opens the nine figures with value, percentile and weight.
- Instruments without enough history are listed apart with "n of 252 trading days" and never enter the split.
- Suggestion: the amount comes from the Smart Plan with its share and baseline and a link back; profile and limits in
  words; the rule on a ruled left margin; the split as a teal bar plus a table of share and amount that adds to 100 %,
  an explicit "not placed (limits reached)" row, and the excluded instruments with their reasons.
- Fix: the data-status table said "Key set" above "No key" values → the column is "API key".
- Fix: a listing without any price showed "Stale" → it says "No price yet"; stale is kept for missed closes.
- Fix: the profile section title repeated its field label → "Profile used for the split".
- Fix: saving the questionnaire remounted the form and lost the "Saved" message → forms follow their stored values
  without remounting.
- Fix: "at its limit" on every split row hid which cap applied → each row names its cap (instrument, region, currency).
- Known content limit: with no provider keys, only US listings get prices in the tour data, so the USD cap leaves part
  of the amount unplaced. That is the correct output and the page says how to change it.
- **disposition: ship** at this scope.
