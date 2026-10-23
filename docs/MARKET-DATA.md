# Market Data Research

## 1. Header

- Verification date: 2026-10-22. All sources were opened on this date ("read 2026-10-22").
- Scope: end-of-day (EOD) prices for the optional investing module, from FREE provider tiers only, plus daily FX from Frankfurter.
- Rule: free tiers only. Requests carry only ticker symbols and dates (plus the provider's own API key). No sign-ups, no keys, no logins were used in this research.
- Demo keys serve a fixed symbol set. A working demo call does NOT prove free-plan coverage, and a failing demo call does NOT prove the free plan lacks the symbol.
- Terms in this document: "reset" = when the daily quota counter returns to zero.
- Tags: [uncertain] = could not confirm from an official page; the missing piece is stated.

## 2. Provider summary table

| Provider | Free plan limits | Daily reset | History (free) | EOD vs delayed | Markets on free plan | Terms (free) | Link |
|---|---|---|---|---|---|---|---|
| Twelve Data (Basic) | 8 credits/min, 800 credits/day. `time_series`, `eod`, `quote`, `price` cost 1 credit per symbol. | Midnight UTC (support article, about 1 year old) | Not stated on pricing page. `outputsize` up to 5000 rows per call. [uncertain] for a Basic cap. | Real-time US (Basic row), daily bars via `time_series` `1day`, `eod` endpoint. | US stocks and ETFs, forex, crypto. Europe (XETR, XLON, XAMS, XPAR, XBRU, XLIS) needs Grow; Dublin and Milan need Pro. | "Internal non-display usage"; Free Tier data may not be used commercially; display to self allowed, to third parties not. Do not cache beyond documented timeframes. | https://twelvedata.com/pricing |
| EODHD (Free) | 20 calls/day. 1 call per EOD or live request. Pricing page says 20/min; limits page gives a 1,000/min ceiling and no free-specific minute figure. | Midnight GMT (counter resets on first request after midnight) | 1 year of EOD | EOD, plus live/delayed (15-20 min) | Advertised "Global". Free-plan list of exchanges NOT published. Demo key serves 6 symbols only. | Personal, non-commercial use only; no displaying or redistributing to others. | https://eodhd.com/pricing |
| Financial Modeling Prep (Basic) | 250 calls/day. 500 MB bandwidth per trailing 30 days. | [uncertain] (blog says "next day", no zone) | Pricing matrix says 5 years for Basic and Starter | EOD only (no real-time on Basic) | Pricing cards: Starter "US Coverage", Premium "UK and Canada", Ultimate "Global". An FMP how-to (older, v3 era) says the free plan covers US exchanges only. | Personal Use toggle; displaying or redistributing needs a Data Display and Licensing Agreement. | https://site.financialmodelingprep.com/pricing-plans |
| Alpha Vantage (free) | 25 requests/day. Per-minute limit not stated. | Not stated [uncertain] | `outputsize=compact` = latest 100 daily points. `full` (25+ years) is premium. | Daily bars; `GLOBAL_QUOTE` updates at end of trading day on free. `TIME_SERIES_DAILY_ADJUSTED` is premium. | US documented. Non-US symbols (`.LON`, `.DEX`) appear in docs; free-plan coverage not stated. | Terms of Service: personal, non-commercial use grant; commercial-type uses need a written agreement. | https://www.alphavantage.co/premium/ |
| Finnhub (Free) | 60 calls/min, plus a 30 calls/second cap on all plans. No daily cap stated. | n/a (no daily cap stated) | No daily candles on free (`/stock/candle` is Premium) | `/quote` = US current price, previous close. | US only. International market data (TSX, LSE, Euronext, Deutsche Boerse) is not in the Free column. | "Personal Use. Terms apply." | https://finnhub.io/pricing |
| Frankfurter (FX) | Keyless, no key. No numeric limit found in docs [uncertain]. | n/a | From 1999 (ECB) | Daily reference rates | FX only | Free, open source | https://frankfurter.dev |

Sources for the table (all read 2026-10-22): https://twelvedata.com/pricing, https://twelvedata.com/exchanges, https://support.twelvedata.com/en/articles/5615854-credits, https://twelvedata.com/terms, https://eodhd.com/pricing, https://eodhd.com/financial-apis/api-limits, https://eodhd.com/financial-apis/terms-conditions, https://site.financialmodelingprep.com/pricing-plans, https://site.financialmodelingprep.com/how-to/how-to-sign-up-and-use-a-free-stock-market-data-api, https://www.alphavantage.co/premium/, https://www.alphavantage.co/documentation/, https://www.alphavantage.co/terms_of_service/ (PDF), https://finnhub.io/pricing, https://finnhub.io/docs/api/rate-limit, https://finnhub.io/docs/api/quote.

Key reading of the table:
- Only Twelve Data (US only on free) and EODHD (coverage unknown) offer a usable daily-bar endpoint on a free plan with enough calls. FMP Basic is US-only per FMP's own how-to. Alpha Vantage's 25/day is too small for a watchlist. Finnhub free has no daily candles.
- No free provider is confirmed to serve Xetra, LSE or Euronext tickers. UCITS ETFs therefore have NO confirmed free automatic source; manual entry is the confirmed last resort (see section 7).

## 3. Per-provider detail

### 3.1 Twelve Data

- Free plan ("Basic"): 8 API credits per minute, 800 per day. Real-time US equities and ETFs, forex and crypto, "global trial symbols", batch requests, "Internal non-display usage". Internal display access starts at Grow; EOD for global equities and ETFs starts at Grow. (https://twelvedata.com/pricing, read 2026-10-22)
- Credit counting: "Data Weight x Number of Symbols = Credits Used". `/time_series` with 3 symbols costs 3 credits. The per-minute quota is "restored at the start of each new minute". On Basic the daily quota resets to 800 at midnight UTC. (https://support.twelvedata.com/en/articles/5615854-credits, read 2026-10-22; the search tool noted the article is about 370 days old)
- Per-endpoint credit cost (docs): `time_series`, `quote`, `price`, `eod` = 1 per symbol; `time_series/cross` = 5 per request; `api_usage` = 1 per request. (https://twelvedata.com/docs, read 2026-10-22)
- EOD endpoints:
  - `GET https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&outputsize=30&apikey=KEY` (also `start_date`, `end_date` as `YYYY-MM-DD`, `order=asc|desc`, `adjust=all|splits|dividends|none`, default `splits`, `dp`, `exchange`, `mic_code`, `country`, `type`).
  - `GET https://api.twelvedata.com/eod?symbol=AAPL&apikey=KEY` (single latest EOD close; optional `date=YYYY-MM-DD`, `exchange`, `mic_code`).
  - Key can also go in header `Authorization: apikey KEY`, which the docs recommend.
- Symbol format: plain ticker in `symbol`; the exchange goes in a separate `exchange` or `mic_code` parameter (for example `exchange=NASDAQ`, `mic_code=XNAS`). The docs do not describe a `TICKER:EXCHANGE` or `.SUFFIX` form. `isin` is accepted but "ISIN access is activating in the Data add-ons section" (not a free feature). (docs, read 2026-10-22)
- Response, `time_series`: `meta{symbol, interval, currency, exchange_timezone, exchange, mic_code, type}`, `values[{datetime, open, high, low, close, volume}]`, `status`. All numbers are strings. There is no separate adjusted-close field; `adjust` changes the values returned (default: adjusted for splits only).
- Response, `eod`: `{symbol, exchange, mic_code, currency, datetime, timestamp, close}`.
- Batching: comma-separated `symbol=A,B,C` is documented only as "Separate with commas where supported"; credits are charged per symbol either way. A `POST https://api.twelvedata.com/batch` endpoint exists (JSON body of request-id to URL). "Credits are consumed per requested endpoint, with the total usage equal to the sum of individual requests in the batch. If the requested data exceeds your available credits, only partial data will be returned asynchronously until your quota is exhausted." Batching therefore saves HTTP round trips, not credits. Per minute you can still only pull 8 symbols.
- Quota exhaustion: HTTP 429 "Too Many Requests", "API request limit reached for your key. Wait briefly or upgrade your plan". Other codes: 400 bad parameter, 401 bad key, 403 plan lacks the resource ("upgrade required"), 404 data not found, 414 parameter too long, 500. Body shape: `{"code":429,"message":"...","status":"error"}`. The exact 429 message text is not published. [uncertain] (docs errors section, read 2026-10-22)
- Headers: every response carries `api-credits-used` and `api-credits-left` (support article). Not seen on demo calls. [uncertain] whether they appear on every plan; to be checked with a real key.
- Usage endpoint: `GET /api_usage` returns `current_usage`, `plan_limit`, `daily_usage`, `plan_daily_limit`, `plan_category`; costs 1 credit.
- Coverage on free: US exchanges row is "Basic" with "Real-time / EOD" (https://twelvedata.com/exchanges, read 2026-10-22). Min plan for XETR/XLON/XAMS/XBRU/XLIS/XPAR = Grow; XMSM (Dublin)/XMIL/XOSL = Pro.
- Demo-key calls made on 2026-10-22 (symbols and dates only):
  - `time_series?symbol=AAPL&interval=1day&outputsize=2&apikey=demo` -> 200, valid data (NASDAQ/XNGS, USD, `exchange_timezone` America/New_York). Latest row dated 2026-10-21.
  - `eod?symbol=AAPL&apikey=demo` -> 200, `{"symbol":"AAPL","exchange":"NASDAQ","mic_code":"XNGS","currency":"USD","datetime":"2026-10-21",...}`.
  - `time_series?symbol=VWCE&exchange=XETR&...&apikey=demo`, `symbol=IWDA&exchange=Euronext`, and `symbol=AAPL,MSFT,VTI` -> HTTP 401 "The 'demo' API key is only used for initial familiarity...". The demo key serves a fixed set (AAPL worked). These failures say nothing about the free plan.
- Terms (https://twelvedata.com/terms, read 2026-10-22): access is "Internal Use"; Free Tier data may not be used commercially (2.3(l)); display to yourself is allowed, display to third parties needs an add-on (2.2(b), 2.2(e)); do not cache or store beyond the timeframes in the documentation (2.3(g)); no automated tools to exceed rate limits (2.3(h)). The caching timeframes document was not found. [uncertain]. Practical effect: a private single-user app with a short-lived cache is within the stated terms; a multi-user public app is not.

### 3.2 EODHD

- Free plan: 20 API calls/day, "resets at midnight GMT", 1 year of EOD, 15-minute delayed live quotes, welcome bonus of 500 calls (duration not stated). Not included: intraday, fundamentals, WebSocket. Coverage label: "Global", no exchange list for Free. (https://eodhd.com/pricing, read 2026-10-22)
- Limits page (https://eodhd.com/financial-apis/api-limits, read 2026-10-22):
  - Daily reset "midnight GMT"; the counter resets on the first request after midnight.
  - Per-minute: 1,000 requests/min on paid; "The page doesn't state a separate per-minute limit for the free plan". The pricing page says 20/min for Free. The two pages disagree. [uncertain]
  - HTTP 402 = daily calls used up ("API Rate Limit Exceeded. Please, contact our support team: support@eodhistoricaldata.com"). A refused request costs nothing.
  - HTTP 429 = too many requests this minute; wait for the `Retry-After` header.
  - HTTP 401 = missing or invalid token. 404 = unknown ticker (and 404 lookups are still charged).
  - Successful responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining` (per-minute, not daily). Seen on demo calls: `x-ratelimit-limit: 1200`.
  - Cost per call: EOD, splits/dividends, delayed live per symbol, search, exchanges list, exchange symbol list = 1; intraday, technical, news, screener = 5; fundamentals = 10; Bulk API = 100 (or 100 + N with `symbols`); `/api/user` = 0.
- EOD endpoint: `GET https://eodhd.com/api/eod/{SYMBOL}?api_token=KEY&fmt=json&from=YYYY-MM-DD&to=YYYY-MM-DD&period=d&order=a|d` (https://eodhd.com/financial-apis/api-for-historical-data-and-volumes, read 2026-10-22). One call returns the whole `from`..`to` range and costs 1 call. `fmt` defaults to CSV; a misspelled `fmt`/`period`/`order` is silently replaced by the default.
- Symbol format: `TICKER.EXCHANGE`, for example `AAPL.US`, `BP.LSE`, `SAP.XETRA`. `.US` suffix is optional. Euronext uses codes such as `.AS` (Amsterdam), `.PA`, `.MI` in EODHD's own scheme [uncertain: the exchange code list page was not opened].
- Response fields (confirmed by demo call): `date`, `open`, `high`, `low`, `close`, `adjusted_close`, `volume`. `close` is raw; `adjusted_close` is adjusted for splits and dividends. No currency field in the EOD response; currency comes from the exchange or from the search/fundamentals endpoints. [uncertain] whether a free-plan call can look it up cheaply.
- Delayed live: `GET https://eodhd.com/api/real-time/{TICKER}?api_token=KEY&fmt=json&s=SYM2,SYM3`. "1 API call per ticker", so multi-symbol requests cost one call per symbol. Fields: `code`, `timestamp`, `close`, `previousClose`, `change`, `change_p`, open/high/low/volume. Delay 15-20 min. Recommended max 15-20 symbols per request. (https://eodhd.com/financial-apis/live-realtime-stocks-api, read 2026-10-22)
- Batching: no multi-symbol EOD call. The only batch-style EOD route is the Bulk API (100 calls), which is more than the whole free day (20). Not usable on Free.
- Demo key: serves only AAPL.US, TSLA.US, BTC-USD.CC, VTI.US, AMZN.US, EURUSD.FOREX (docs also list MSFT.US/EUR.FOREX in one place; inconsistent). Other tickers return 403 (Forbidden), even unknown ones.
- Demo calls made 2026-10-22:
  - `eod/VTI.US?api_token=demo&fmt=json&from=2026-10-15` -> 200, 5 rows to 2026-10-21 (`close` 379.15, equal to `adjusted_close`).
  - `eod/AAPL.US?...&order=d&from=2026-10-19` -> 200, 3 rows, newest first.
  - `eod/VWCE.XETRA`, `eod/IWDA.AS`, `exchange-symbol-list/US` with demo -> HTTP 403 "Forbidden" (HTML body). This is the demo-key restriction, not proof of free-plan coverage.
- Terms (https://eodhd.com/financial-apis/terms-conditions, read 2026-10-22): "Non-Professional Users are permitted to store, manipulate, and analyze the data for private, non-commercial purposes." Selling, redistributing and displaying to others is restricted. No attribution rule on the page. The page says one key allows 100,000 requests/day (paid) and gives no free figures.

### 3.3 Financial Modeling Prep (FMP)

- Notes on access: the FMP site returns HTTP 403 to curl and WebFetch. The pages below were read in the Playwright browser (public pages, no login).
- Basic plan card: "$0/month, 250 Calls / Day, End of Day Historical Data, Profile and Reference Data, Experience over 150+ Endpoints". Matrix rows: "Real-time Data: -", "Historical Data Range: 5 years" (Basic/Starter), 30+ years (Premium/Ultimate). Footer: "trailing 30 days bandwidth limit ... Free plan - 500MB". "Displaying or redistributing data sourced from FMP requires a specific Data Display and Licensing Agreement". A "Personal Use / Commercial Use" toggle exists. (https://site.financialmodelingprep.com/pricing-plans, read 2026-10-22)
- Coverage: Starter card says "US Coverage", Premium "UK and Canada Coverage", Ultimate "Global Coverage". Basic is below Starter. FMP's how-to page says: "This plan covers all stocks within the US exchanges. If you are looking for global exchanges, you will need to upgrade your plan" (https://site.financialmodelingprep.com/how-to/how-to-sign-up-and-use-a-free-stock-market-data-api, read 2026-10-22; the page is old: it references `/api/v3/`). ETF coverage on Basic: the per-feature matrix marks were not extractable from the page text. [uncertain]
- Free-plan limit of history: pricing matrix says 5 years. [uncertain] whether it applies to the Basic column only or both Basic and Starter; the text reads "5 years / 5 years / 30+ years / 30+ years" for the four columns.
- EOD endpoints (docs page https://site.financialmodelingprep.com/developer/docs/stable/historical-price-eod-light, read 2026-10-22):
  - `GET https://financialmodelingprep.com/stable/historical-price-eod/light?symbol=AAPL&from=YYYY-MM-DD&to=YYYY-MM-DD&apikey=KEY` -> `[{symbol, date, price, volume}]`. Max 5000 records per request.
  - `GET https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=AAPL&from=...&to=...&apikey=KEY` (named in the FAQ). The FAQ states `close` is adjusted for splits only, and `adjClose` for splits and dividends.
  - Full field list of `/full` and which endpoints Basic can call were not shown. [uncertain]
- Symbol format: plain ticker for US (`AAPL`). Non-US suffix format (`.L`, `.DE`, `.AS`) not documented on the pages opened. [uncertain]
- Batching: "Stock Batch Quote" and "Bulk and Batch Delivery" appear in the matrix; the card puts "Bulk and Batch Delivery" under Ultimate. Whether the Basic plan can call batch quote endpoints, and how they count against 250/day, was not confirmed. [uncertain]
- Quota signalling: a blog on FMP's own site says HTTP 429 once the daily cap is exceeded and the limit resets the next day (search-tool summary of an FMP blog; the exact post was not opened by me, so treat as secondary). [uncertain] on error body text and the reset zone.
- No documented public demo key found, so no demo call was made.

### 3.4 Alpha Vantage

- Free tier: "25 API requests per day" (https://www.alphavantage.co/premium/, read 2026-10-22). Premium plans list 75, 150, 300, 600 or 1200 requests/min and "No daily limits". Per-minute limit and daily reset time for the free key: not stated. [uncertain]
- EOD endpoint: `GET https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=IBM&outputsize=compact&apikey=KEY` (https://www.alphavantage.co/documentation/, read 2026-10-22). `compact` = latest 100 daily points; `full` (25+ years) "is available to premium keys". `TIME_SERIES_DAILY_ADJUSTED` is labelled premium. `GLOBAL_QUOTE` (one symbol per request) updates at end of day for all users; real-time and 15-minute delayed US data need a premium plan.
- Response (confirmed by demo call): `Meta Data{"1. Information","2. Symbol","3. Last Refreshed","4. Output Size","5. Time Zone":"US/Eastern"}` and `Time Series (Daily){ "YYYY-MM-DD": {"1. open","2. high","3. low","4. close","5. volume"} }`. `GLOBAL_QUOTE` returns `"05. price"`, `"07. latest trading day"`, `"08. previous close"`. No currency field. No adjusted close on the free endpoint.
- Symbol format: US plain (`IBM`). Non-US with suffix per docs: `TSCO.LON` (London), `MBG.DEX` (XETRA), `SHOP.TRT` (Toronto), `RELIANCE.BSE`. Free-plan coverage of these is not stated. [uncertain]
- Batching: none (one symbol per call; `GLOBAL_QUOTE` is one symbol per request). Each call counts 1 of 25.
- Quota signalling: HTTP 200 with a JSON body containing an `"Information"` (or `"Note"`) text key rather than data. The exact limit message text was not found on the pages opened. [uncertain] The demo-key message seen: `{"Information": "The **demo** API key is for demo purposes only. Please claim your free API key ..."}`. Client code should treat "200 without 'Time Series (Daily)' key" as a failure.
- Demo calls made 2026-10-22: `TIME_SERIES_DAILY&symbol=IBM&apikey=demo` -> valid, last refreshed 2026-10-21. `GLOBAL_QUOTE&symbol=IBM` -> valid. `TIME_SERIES_DAILY&symbol=MBG.DEX` and `symbol=VTI` -> 200 with the "demo key for demo purposes only" Information message. Demo serves a fixed symbol set (IBM worked).
- Terms (https://www.alphavantage.co/terms_of_service/, a PDF; text extracted with a script, read 2026-10-22): licence is "for personal, non-commercial use"; usage counts as commercial if used by a business, or if the information is part of an activity that lets other people access it, or if the user is employed by a financial firm. Display or caching rules were not found in the extracted text. [uncertain]

### 3.5 Finnhub

- Free plan: "60 API calls/minute"; "On top of all plan's limit, there is a 30 API calls/second limit"; exceeding it returns HTTP 429. No daily cap is stated. License: "Personal Use. Terms apply." (https://finnhub.io/pricing and https://finnhub.io/docs/api/rate-limit, read 2026-10-22)
- Free column coverage: "US Market Data: Coverage US". "OHLC" (30+ years) is only in the paid All-In-One column. "International Market Data: TSX, LSE, Euronext, Deutsche Boerse" is not marked for Free (paid only: "LSE data is delayed by 15 minutes. Other international markets support end-of-day data only").
- Endpoint usable on free: `GET https://finnhub.io/api/v1/quote?symbol=AAPL&token=KEY` (header `X-Finnhub-Token` also accepted). Response: `c` current price, `d` change, `dp` percent change, `h`, `l`, `o`, `pc` previous close, `t` UNIX time. "Get real-time quote data for US stocks"; international real-time is Enterprise only. (https://finnhub.io/docs/api/quote, read 2026-10-22)
- `Stock Candles (OHLCV)` is labelled "Premium: Premium Access Required" in the docs sidebar. So there is NO free daily history. Finnhub is only a US "last price / previous close" fallback, and only after the close if read late (the `pc` field is the previous session close).
- Whether `/quote` works for US-listed ETFs on free: not stated. [uncertain]
- Batching: none (one symbol per `/quote` call). Quota signal: HTTP 429; body text not documented. [uncertain]
- No demo key documented, no call made.

## 4. FX: Frankfurter

- Base URL: `https://api.frankfurter.dev`. No API key. (https://frankfurter.dev, read 2026-10-22)
- Source: 105 central banks and official sources, 223 currencies, history back to 1948 (v2). The European Central Bank is the original source. By default v2 returns a BLENDED rate across providers; this is Frankfurter's own calculation, "not an official rate". For the ECB's own euro reference rate use `/v2/providers/ecb/rates` or `providers=ECB`. (frankfurter.dev, https://frankfurter.dev/license/, read 2026-10-22)
- v1 vs v2:
  - v1 (`/v1/latest`, `/v1/{date}`, `/v1/{start}..{end}`, `/v1/currencies`) is deprecated "in favor of v2" but "remains available indefinitely" (frankfurter.dev, https://frankfurter.dev/v1/, read 2026-10-22). The live responses carry the headers `deprecation: @1779103800` (a Unix time, = 2026-05-18 11:30 UTC) and `link: <https://api.frankfurter.dev/v2/rates>; rel="successor-version"` (curl, read 2026-10-22). v1 is ECB data only (30 currencies, see below).
  - v2 (current): `/v2/rates`, `/v2/rate/{base}/{quote}`, `/v2/currencies`, `/v2/currency/{code}`, `/v2/providers`, `/v2/providers/{key}`, `/v2/providers/{key}/rates`, `/v2/providers/{key}/rate/{base}/{quote}`. Parameters of `/v2/rates`: `base`, `quotes`, `date`, `from`, `to`, `group=week|month`, `providers`, `expand=providers`. CSV via `/v2/rates.csv` or `Accept: text/csv`; NDJSON via `Accept: application/x-ndjson`. Errors: 400, 404, 422 with JSON body (404 seen: `{"status":404,"message":"not found"}`).
- Recommendation: build on v2 with `providers=ECB` (or `/v2/providers/ecb/rates`) so the EUR rate equals the ECB reference rate and the behaviour matches v1. Keep the v1 shape as a documented fallback because it "will continue to work".
- Real calls made 2026-10-22 (no key, no data other than currency codes and dates sent):

| Call | Result shape |
|---|---|
| `GET /v1/latest?base=EUR&symbols=USD,GBP` | `{"amount":1.0,"base":"EUR","date":"2026-10-21","rates":{"GBP":0.83825,"USD":1.1234}}` |
| `GET /v1/2026-10-16?base=EUR&symbols=USD` | `{"amount":1.0,"base":"EUR","date":"2026-10-16","rates":{"USD":1.1253}}` |
| `GET /v1/2026-10-18?base=EUR&symbols=USD` (Sunday) | returned `"date":"2026-10-16"` (previous working day) |
| `GET /v1/2026-10-12..2026-10-21?base=EUR&symbols=USD` | `{"amount":1.0,"base":"EUR","start_date":...,"end_date":...,"rates":{"2026-10-12":{"USD":1.1181},...}}`, working days only (no 17/18 Oct) |
| `GET /v2/rates?base=EUR&quotes=USD,GBP` (blended) | `[{"date":"2026-10-22","base":"EUR","quote":"GBP","rate":0.83974},{"date":"2026-10-22","base":"EUR","quote":"USD","rate":1.123}]` |
| `GET /v2/providers/ecb/rates?base=EUR&quotes=USD,GBP` | `[{"date":"2026-10-21","base":"EUR","quote":"GBP","rate":0.83825},{"date":"2026-10-21","base":"EUR","quote":"USD","rate":1.1234}]` (same numbers as v1) |
| `GET /v2/rates?providers=ECB&base=EUR&quotes=USD&from=2026-10-14&to=2026-10-21` | array of `{date, base, quote, rate}`, working days only |
| `GET /v2/rates?from=2026-10-12&to=2026-10-21&base=EUR&quotes=USD` (blended) | includes weekend dates 17 and 18 Oct, and rates differ from ECB (for example 16 Oct: 1.1231 blended vs 1.1253 ECB) |
| `GET /v2/providers/ecb` | `{key, name, country_code, rate_type:"reference rate", pivot_currency, data_url, terms_url, start_date:"1999-01-04", end_date, publish_cadence:"daily", currencies:[...]}` |

- Lesson from the calls: the blended v2 default can return a different number and a "today" date earlier than the ECB; for tax/estimate figures always request `providers=ECB`.
- Currency list: v1 `/v1/currencies` returns 30 ECB currencies: AUD, BRL, CAD, CHF, CNY, CZK, DKK, EUR, GBP, HKD, HUF, IDR, ILS, INR, ISK, JPY, KRW, MXN, MYR, NOK, NZD, PHP, PLN, RON, SEK, SGD, THB, TRY, USD, ZAR. The ECB provider record in v2 lists more, including legacy codes (for example BGN, HRK, RUB). v2 `/v2/currencies` returns 223 across all providers. The investing module needs only USD, GBP, CHF and perhaps JPY; all are present.
- Update time: "Rates are updated daily around 16:00 CET" (https://frankfurter.dev/v1/, read 2026-10-22). The ECB says "The reference rates are usually updated at around 16:00 CET every working day, except on TARGET closing days" and are based on a concertation procedure around 14:10 CET (https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html, read 2026-10-22). "CET" in both statements: whether this means CEST in summer is not stated on the pages; treat the publication as 16:00 Frankfurt/Brussels local time = 17:00 Europe/Athens. [uncertain]
- Weekends/holidays: no ECB rate on those days. v1 returns the previous working day's rate (seen: Sunday 2026-10-18 returned 2026-10-16). Store the returned `date`, not the requested date.
- Limits: "No quotas and no monthly or daily caps. Requests are rate-limited to prevent abuse, but no numeric limits are published." Caching and storing daily data locally is encouraged. (frankfurter.dev, read 2026-10-22) Response headers: `cache-control: public, max-age=86400` (v1 and historical v2), the latest v2 call used `max-age=67290`. No `X-RateLimit` headers seen.
- Terms: code/docs under the MIT licence; the rates are public data "shared for information", "as is, with no warranty"; provider terms apply (ECB terms link: https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html, listed in the provider record; I did not open it). The licence page states no specific ECB attribution requirement. [uncertain] whether the ECB terms require attribution; the ECB disclaimer page was not opened. Frankfurter's privacy note: the API "does not collect or log personal data, IP addresses, or request URLs".
- Sends only currency codes and dates. Fits the project rule.

## 5. Refresh timing

### 5.1 US close in Europe/Athens

- NYSE core session: 9:30 a.m. to 4:00 p.m. ET (https://www.nyse.com/trade/hours-calendars, read 2026-10-22). Same for NYSE Arca and NYSE American.
- US DST: starts 2:00 a.m. on the second Sunday of March, ends 2:00 a.m. on the first Sunday of November (2026: 8 March to 1 November) (https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst, read 2026-10-22).
- EU DST: summer time from the last Sunday of March to the last Sunday of October (https://transport.ec.europa.eu/transport-themes/summertime_en, read 2026-10-22). The page notes the Commission's 2018 proposal to end clock changes is not finalised ("The Council has not yet finalised its position"). Greece follows EU rules, so Athens is EET (UTC+2) in winter, EEST (UTC+3) in summer. The 01:00 UTC changeover time is not on that page. [uncertain]; it does not change any result below.
- Computed with the IANA tz database (Python `zoneinfo`, run 2026-10-22), for 16:00 America/New_York:

| Period | US clocks | Athens clocks | 16:00 ET = Athens time | 00:00 ET = Athens time |
|---|---|---|---|---|
| 2026-01-01 to 2026-03-07 | EST | EET | 23:00 | 07:00 |
| 2026-03-08 to 2026-03-28 (US DST, EU not yet) | EDT | EET | 22:00 | 06:00 |
| 2026-03-29 to 2026-10-24 | EDT | EEST | 23:00 | 07:00 |
| 2026-10-25 to 2026-10-31 (EU back to winter, US still DST) | EDT | EET | 22:00 | 06:00 |
| 2026-11-01 to 2027-03-13 | EST | EET | 23:00 | 07:00 |
| 2027-03-14 to 2027-03-27 (US DST, EU not yet) | EDT | EET | 22:00 | 06:00 |
| 2027-03-28 to 2027-10-30 | EDT | EEST | 23:00 | 07:00 |
| 2027-10-31 to 2027-11-06 | EDT | EET | 22:00 | 06:00 |
| 2027-11-07 on | EST | EET | 23:00 | 07:00 |

- Early close days (1:00 p.m. ET) map to 20:00 Athens in these cases: Fri 2026-11-27, Thu 2026-12-24, Fri 2027-11-26 (all in standard time on both sides). Source: NYSE page above.
- Context for today (2026-10-22): Athens is still on summer time and the US is on summer time, so 16:00 ET = 23:00 Athens now. From Sunday 2026-10-25 until Saturday 2026-10-31 the close is at 22:00 Athens. From Sunday 2026-11-01 it is 23:00 Athens again.

### 5.2 NYSE holidays (NYSE page, read 2026-10-22; page also covers 2028)

| 2026 | 2027 |
|---|---|
| Thu 1 Jan New Year's Day | Fri 1 Jan |
| Mon 19 Jan MLK Day | Mon 18 Jan |
| Mon 16 Feb Washington's Birthday | Mon 15 Feb |
| Fri 3 Apr Good Friday | Fri 26 Mar |
| Mon 25 May Memorial Day | Mon 31 May |
| Fri 19 Jun Juneteenth | Fri 18 Jun (observed) |
| Fri 3 Jul Independence Day (observed) | Mon 5 Jul (observed) |
| Mon 7 Sep Labor Day | Mon 6 Sep |
| Thu 26 Nov Thanksgiving | Thu 25 Nov |
| Fri 25 Dec Christmas | Fri 24 Dec (observed) |

Early closes at 1:00 p.m. ET listed by NYSE: 2026-11-27, 2026-12-24, 2027-11-26. The page lists no 2027 Christmas Eve early close because 24 Dec 2027 is the observed Christmas holiday.

Euronext closed on all its markets in 2026: 1 Jan, 3 Apr, 6 Apr, 1 May, 25 Dec; half days on 24 and 31 Dec in Amsterdam, Brussels, Dublin, Lisbon, Paris (https://www.euronext.com/en/trade/trading-hours-holidays, read 2026-10-22). Xetra and LSE holiday lists: not opened. [uncertain]

### 5.3 When each provider documents EOD data as available

| Provider | Documented availability | Source |
|---|---|---|
| Twelve Data | "Historical and end-of-day data opens after 12:00 AM ET (midnight Eastern Time) on the next trading day" once each market closes; "accessible starting with the Basic plan". Prices start as "preliminary data from the exchange" and are final "after the exchange's official daily reconciliation" (time not given). | https://support.twelvedata.com/en/articles/9935903-us-equities-market-data and https://support.twelvedata.com/en/articles/12682324-end-of-day-eod-pricing-market-data, read 2026-10-22 |
| EODHD | "We update each stock exchange 2-3 hours after the market closes"; NYSE and NASDAQ "within 15 minutes after the market closes"; US mutual funds, PINK, OTCBB and some indices "only the next morning, starting at 3-4 am ET" (finish 5-6 am ET). | https://eodhd.com/financial-apis/api-for-historical-data-and-volumes, read 2026-10-22 |
| FMP | Not found on pages opened. [uncertain] | |
| Alpha Vantage | `GLOBAL_QUOTE` "updates at the end of each trading day for all users" (no clock time). | https://www.alphavantage.co/documentation/, read 2026-10-22 |
| Finnhub | `/quote` is real-time US; no EOD statement; candles are Premium. | https://finnhub.io/docs/api/quote, read 2026-10-22 |
| Frankfurter / ECB | About 16:00 CET on working days, except TARGET closing days. | https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html, read 2026-10-22 |

Observed check: a Twelve Data demo call at about 05:10 GMT on 2026-10-22 (00:10 ET) already returned the 2026-10-21 bar for AAPL, matching the documented "after 12:00 AM ET".

### 5.4 Recommended refresh rule

1. One scheduled job per day at 07:30 Europe/Athens on Tuesday to Saturday (covers the Monday to Friday sessions). The timezone is configured as Europe/Athens, never a fixed UTC offset.
   - 07:30 is after "00:00 ET next day" in both cases (06:00 in the March/late-Oct windows, 07:00 otherwise), so Twelve Data's documented availability holds with a 30 to 90 minute margin.
   - It is far after EODHD's "2-3 hours after close" and "within 15 minutes" for NYSE/NASDAQ, and after US mutual funds / OTC (done by 5-6 am ET = 11:00-13:00 Athens: NOT covered; if a mutual fund or OTC symbol is ever added, run a second pass at 13:30 Athens). The starter watchlist has none.
   - European exchanges (Xetra, LSE, Euronext) close at about 17:30 local or earlier [uncertain: trading hours pages for LSE/Xetra not read], so their data is ready long before 07:30 Athens.
2. For each symbol, compute the expected last close date from an exchange-calendar table (US holidays above, weekends). If the provider returns an older date than expected, treat it as "not yet published": keep the old cached value, mark the quote as `stale` in the UI, and retry once at 12:30 Athens. After the second miss, fall through to the next provider.
3. Store the provider's returned bar date (exchange local date), never the request date; store `fetchedAt` in UTC.
4. Catch-up at app start: if the newest cached close is older than the expected last close and the next scheduled run is more than 6 hours away, run one refresh immediately. Rate budgets still apply.
5. Never poll intraday. Free tiers do not support it and EOD is all the module needs.
6. FX: one Frankfurter call per day, cached 24 hours. ECB publishes at about 16:00 CET (17:00 Athens), so a call inside the 07:30 job always sees the previous working day's ECB rate. If the call fails, keep the last known rate and show its date.

## 6. Starter watchlist

Educational starter list. Not a recommendation, not a prediction, not a buy or sell signal. TER and figures are as shown on the issuer pages on 2026-10-22 and change over time. `core` is a suggested flag for the "broad-market ETF" bucket in the plan (PLAN.md section 6.6).

Coverage legend: **DOC** = confirmed by provider documentation or pricing page; **DEMO** = confirmed by a successful demo-key call on 2026-10-22 (proves the symbol format and response, not free-plan coverage); **[uncertain]** = not confirmed.

### 6.1 Instruments

| # | Name | Ticker (provider symbol) | Exchange | ISIN | Trading ccy | Type | Domicile | TER | core | Region | Free-provider coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | iShares Core MSCI World UCITS ETF USD (Acc) | IWDA (`IWDA.AS` on EODHD) | Euronext Amsterdam | IE00B4L5Y983 | EUR | ETF, accumulating | Ireland | 0.20% | yes | Global developed | [uncertain]: no free provider confirmed. EODHD possible (probe), Twelve Data needs Grow (XAMS). Manual fallback confirmed. |
| 2 | Vanguard FTSE All-World UCITS ETF USD (Acc) | VWCE (`VWCE.XETRA` on EODHD) | Xetra | IE00BK5BQT80 | EUR | ETF, accumulating | Ireland | 0.14% | yes | Global incl. emerging | [uncertain]: as row 1. Twelve Data needs Grow (XETR). |
| 3 | iShares Core S&P 500 UCITS ETF USD (Acc) | SXR8 (`SXR8.XETRA`) | Xetra | IE00B5BMR087 | EUR | ETF, accumulating | Ireland | 0.07% | yes | US large cap | [uncertain]: as row 1. |
| 4 | iShares Core MSCI EM IMI UCITS ETF USD (Acc) | IS3N (`IS3N.XETRA`) | Xetra | IE00BKM4GZ66 | EUR | ETF, accumulating | Ireland | 0.18% | no (regional satellite) | Emerging markets | [uncertain]: as row 1. |
| 5 | iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc) | AGGH (`AGGH.XETRA`) | Xetra | IE00BDBRDM35 | EUR | Bond ETF, accumulating, EUR hedged | Ireland | 0.10% | no (bond; only if the module accepts bonds) | Global bonds | [uncertain]: as row 1. |
| 6 | Vanguard Total World Stock ETF | VT | NYSE Arca | US9220427424 (derived, see note) | USD | ETF | United States | 0.06% | yes | Global | DOC (Twelve Data Basic: US stocks and ETFs). EODHD demo returns 403 for `VT.US` (not a demo symbol; says nothing about the free plan). |
| 7 | Vanguard Morningstar Total Stock Market ETF (formerly shown as Total Stock Market) | VTI | NYSE Arca | US9229087690 (derived) | USD | ETF | United States | 0.03% | yes | US total market | DEMO (EODHD `VTI.US` returned 5 rows, close 379.15 on 2026-10-21). DOC (Twelve Data). |
| 8 | Apple Inc. | AAPL | Nasdaq | US0378331005 | USD | Common stock | United States | n/a | no | US | DEMO (Twelve Data `time_series` and `eod`; EODHD `AAPL.US`). Alpha Vantage demo serves only IBM in my tests. |
| 9 | Microsoft Corp. | MSFT | Nasdaq | US5949181045 (derived) | USD | Common stock | United States | n/a | no | US | DEMO (EODHD `MSFT.US`, 2 rows, close 532.95 on 2026-10-21). DOC (Twelve Data). |
| 10 | Amazon.com Inc. | AMZN | Nasdaq | US0231351067 (derived) | USD | Common stock | United States | n/a | no | US | DEMO (EODHD `AMZN.US`, 2 rows, close 262.37 on 2026-10-21). DOC (Twelve Data). |

Notes:
- US-domiciled ETFs (rows 6 and 7): may not be available to EU retail investors; check your broker.
- Why the UCITS rows use EUR listings: the user buys in euro on a European venue. Alternative listings (from the iShares and Vanguard pages): IWDA also trades as `IWDA` USD and `SWDA` GBP on the London Stock Exchange and as `EUNL` EUR on Xetra; VWCE also trades as `VWCE` EUR on Borsa Italiana and Euronext Amsterdam, and as `VWRA` USD / `VWRP` GBP in London; CSPX also trades as `CSPX` USD in London and `CSPX` EUR on Euronext Amsterdam; EIMI also trades as `EIMI` USD in London and `EMIM` EUR on Euronext Amsterdam. Store `providerSymbols` per provider, since the same fund has different tickers per venue.
- Derived ISINs: where the issuer page shows the CUSIP but not the ISIN, ISIN = "US" + CUSIP + ISO 6166 check digit. I computed it with a script; the same script reproduces the AAPL ISIN shown in the Twelve Data docs (US0378331005) and the AMZN ISIN quoted in an SEC filing summary (US0231351067). CUSIPs read: VT 922042742 and VTI 922908769 (Vanguard pages, read 2026-10-22), MSFT 594918104 (Microsoft IR FAQ, read 2026-10-22). AMZN CUSIP 023135106 came from a search-result summary of an SEC document, not from a page I opened. [uncertain]
- The vanguard.com VTI page now titles the fund "Vanguard Morningstar Total Stock Market ETF" with benchmark "Morningstar US Total Market Index"; the older name was "Vanguard Total Stock Market ETF". The ticker is unchanged. The adapter should match on ticker + exchange, never on name.
- Demo-key results prove the format and the response only. For the UCITS rows 1 to 5 and for VT, free-plan coverage can only be settled by the live checklist in section 8.
- No instrument is leveraged or crypto. The watchlist schema fields `leveraged` and `crypto` are false for all rows.
- Twelve Data's demo key also serves ETF `QQQ` (Invesco QQQ, Nasdaq, USD, `type: ETF`; call confirmed 2026-10-22). It is a narrow Nasdaq-100 fund, so it is not on the starter list, but it is a useful ETF sample for adapter tests.

### 6.2 Sources for the table (all read 2026-10-22)

- IWDA / IE00B4L5Y983: https://www.ishares.com/uk/individual/en/products/251882/ishares-msci-world-ucits-etf-acc-fund (TER 0.20%, Ireland, base USD, accumulating, launch 25 Sep 2009; listings: Euronext Amsterdam IWDA EUR, Xetra EUNL EUR, LSE SWDA GBP, LSE IWDA USD).
- VWCE / IE00BK5BQT80: https://www.vanguard.co.uk/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating (OCF/TER 0.14%, Ireland, base USD, accumulating; listings: Xetra VWCE EUR, Euronext Amsterdam VWCE EUR, Borsa Italiana VWCE EUR, LSE VWRA USD and VWRP GBP, SIX VWRA CHF).
- SXR8 / IE00B5BMR087: https://www.ishares.com/uk/individual/en/products/253743/ishares-sp-500-b-ucits-etf-acc-fund (TER 0.07%, Ireland, base USD, accumulating; Xetra SXR8 EUR, Euronext Amsterdam CSPX EUR, LSE CSPX USD).
- IS3N / IE00BKM4GZ66: https://www.ishares.com/uk/individual/en/products/264659/ishares-msci-emerging-markets-imi-ucits-etf (TER 0.18%, Ireland, base USD, accumulating; Xetra IS3N EUR, Euronext Amsterdam EMIM EUR, LSE EIMI USD).
- AGGH / IE00BDBRDM35: https://www.ishares.com/uk/individual/en/products/291770/ishares-core-global-aggregate-bond-ucits-etf (TER 0.10%, Ireland, share class currency EUR, base USD, accumulating; Xetra AGGH EUR, Euronext Amsterdam AGGH EUR, Borsa Italiana AGGH EUR).
- VT: https://investor.vanguard.com/investment-products/etfs/profile/vt (expense ratio 0.06% as of 02/27/2026, NYSE Arca, inception 06/24/2008, CUSIP 922042742; the page is JavaScript-rendered, read in a browser).
- VTI: https://investor.vanguard.com/investment-products/etfs/profile/vti (expense ratio 0.03% as of 04/28/2026, NYSE Arca, inception 05/24/2001, CUSIP 922908769; market price $377.09 as of 10/20/2026, which equals the EODHD demo close for 2026-10-20).
- MSFT: https://www.microsoft.com/en-us/investor/faq (CUSIP 594918104, Nasdaq). AAPL: https://investor.apple.com/faq/default.aspx (Nasdaq, AAPL). AAPL ISIN: example value in https://twelvedata.com/docs (`isin` parameter).
- iShares TER values are "Total Expense Ratio" as printed on the page; Vanguard UK shows "OCF/TER". Both are annual percentages of fund assets.

## 7. Recommended provider chain

### 7.1 Chain per market

| Market | Chain (try in order) | Why |
|---|---|---|
| US-listed stocks and ETFs (NYSE, Nasdaq, NYSE Arca) | 1. Twelve Data `time_series`. 2. EODHD `eod/{T}.US`. 3. FMP `historical-price-eod/light` (only if a key is added). 4. Alpha Vantage `TIME_SERIES_DAILY` compact. 5. Finnhub `/quote` (previous-close sanity value only). 6. Manual price. | Twelve Data Basic lists US stocks and ETFs, has the largest free budget (800/day) and the demo call returned fresh data. EODHD is a second source with 1 call per symbol. FMP and Alpha Vantage are small or US-only. Finnhub free has no daily history. |
| London (LSE), Xetra, Euronext (Amsterdam, Paris, Brussels, Lisbon) | 1. EODHD (free coverage unconfirmed, must be probed per symbol). 2. Alpha Vantage with `.LON` or `.DEX` symbols (free coverage unconfirmed). 3. Manual price. | Twelve Data needs Grow for these exchanges (https://twelvedata.com/exchanges). FMP free is US-only per its own how-to. Finnhub free has no international data. No free provider is confirmed. |
| Dublin (XMSM), Milan (XMIL), Oslo | Manual price (Twelve Data lists these at Pro). | |
| FX (EUR vs USD, GBP, CHF...) | Frankfurter v2 with `providers=ECB`, then v1 `/v1/latest`, then last cached rate. | Keyless, no daily cap published. |
| Last resort for any instrument | Manual price entry with date; the UI marks it "manual" and shows its age. | Always available, confirmed by design. |

Rules for the chain:
1. Per (instrument, provider) pair, cache the outcome: `ok`, `not_covered` (403/plan or 404/unknown symbol), `quota`, `error`. A `not_covered` result is cached for 30 days and the provider is skipped, so a symbol does not burn calls every day.
2. HTTP 429 or 402, or a 200 body with an Alpha Vantage `Information` key, stops that provider for the rest of the budget day (see reset times in section 2). Do not retry inside the same run.
3. Never send anything but symbols, dates and the API key. No user ids, no amounts.
4. Persist `source` (provider key or `manual`), `barDate`, `fetchedAt`, `currency` and `adjusted` flag on every price. Twelve Data's `time_series` values are split-adjusted only by default; EODHD offers both `close` (raw) and `adjusted_close`. Pick one convention per instrument (suggest the split-and-dividend adjusted close for returns, raw close for valuation) and never mix providers inside one return series without a note.

### 7.2 Daily call budgets (with safety margin)

| Provider | Hard limit | App budget per day | Per-minute cap in the app | Notes |
|---|---|---|---|---|
| Twelve Data | 800 credits/day, 8/min | 640 (80%) | 6 credits/min | 1 credit per symbol, so a 30-symbol run takes about 5 minutes. Keep the `api-credits-left` header as the live counter if present. |
| EODHD | 20 calls/day | 16 (80%) | 10/min | A 404 or 403 on a ticker is still charged. Reserve 4 for retries and for the user adding an instrument. |
| FMP | 250 calls/day, 500 MB per 30 days | 200 | 10/min | Per-minute limit not stated for Basic. [uncertain] |
| Alpha Vantage | 25 requests/day | 20 | 1 per 12 s (no per-minute limit stated) | Use only as a last automatic fallback. |
| Finnhub | 60/min, 30/s | 300 self-imposed | 30/min | `/quote` only. |
| Frankfurter | none published | 2 | n/a | One call per day is enough. |

Quota counters must be keyed by the provider's own reset boundary: Twelve Data midnight UTC, EODHD midnight GMT, others unknown (use UTC midnight and treat a quota error as the true signal). In summer Athens time, midnight UTC is 03:00; in winter it is 02:00. The 07:30 Athens refresh is never near these resets.

### 7.3 Universe size

- Target 20 to 30 instruments (as in the brief). Practical caps from the free tiers:
  - US-listed: up to about 30 per day on Twelve Data alone (30 of 640 credits).
  - European listings: at most 16 per day on EODHD, and only if EODHD proves to cover them. This is the binding limit; otherwise they are manual.
- Suggest a UI guard: warn above 30 instruments and block adding above 40.

### 7.4 Cache and refresh TTL

- Closed daily bars never change except for corporate-action adjustments, so store them in a Mongo `prices` collection keyed by (instrument, barDate, source).
- Do not call a provider if the cached newest bar date already equals the expected last close date (section 5.4). This makes a repeat run within the same day free.
- Request window: ask for the last 10 calendar days (`outputsize=7` for Twelve Data, `from=` date for EODHD). History costs the same single credit/call, so the same request also heals gaps from missed days and a first run can request 250 rows (about one year; EODHD free only has 1 year).
- Negative cache: 30 days for `not_covered`; 1 hour for `error`; until next budget reset for `quota`.
- Latest-quote TTL for the UI: 20 hours (one refresh per day). Stale label after one missed expected close date.
- Retention: keep the full local history for the user's own watchlist (private use). Twelve Data's terms say not to cache or store beyond documented timeframes (2.3(g)); the timeframes document was not found. [uncertain]
- FX cache: 24 hours, keyed by (base, quote, date).

### 7.5 Back-of-envelope calls per daily refresh

| Scenario | US-listed | UCITS | Twelve Data credits | EODHD calls | Frankfurter | Notes |
|---|---|---|---|---|---|---|
| Starter list (10) | 5 | 5 | 5 | up to 5 (if covered) | 1 | Fits all budgets many times over. If EODHD does not cover UCITS, those 5 are manual: 0 provider calls. |
| 20 instruments | 12 | 8 | 12 | up to 8 | 1 | 12 of 640 and 8 of 16. |
| 30 instruments | 18 | 12 | 18 | up to 12 | 1 | 18 of 640 and 12 of 16. Retry pass adds only the symbols that were stale. |
| Worst case, all fail over | 30 | 0 | 30 on TD, then up to 16 EODHD, 20 AV, 200 FMP, 300 Finnhub | | 1 | Still within every cap. |

Adding one instrument costs 1 call to backfill (1 credit gets up to 5,000 rows on Twelve Data; 1 call gets the whole `from..to` range on EODHD).

## 8. Pending live verification

No free keys exist yet. After the user adds free keys to `.env`, run this checklist once (the app's adapter tests can reuse the same calls). Rules: symbols and dates only; run each step once; write the result (status code, key fields, headers) into `docs/BLOCKERS.md` or `docs/DECISIONS.md`; stop a provider after 3 failed attempts on the same step.

How to keep keys out of shell history and logs: `read -s TD_KEY` (and similarly for the other providers) before the calls, and pass keys in headers where the provider allows it. The variable names below are placeholders, not the project's `.env` names.

### 8.1 Twelve Data (budget used: about 8 credits; mind the 8-per-minute limit, so wait a minute between groups)

| # | Call | Passes if | Settles |
|---|---|---|---|
| T1 | `curl -s -D - -H "Authorization: apikey $TD_KEY" "https://api.twelvedata.com/api_usage"` | 200 with `plan_category` and `plan_daily_limit: 800`, `plan_limit: 8`. Headers show `api-credits-used` and `api-credits-left`. | Plan is Basic; confirms daily 800 and per-minute 8; confirms the credit headers. |
| T2 | `.../time_series?symbol=VTI&interval=1day&outputsize=5` | 200 with `meta.type: "ETF"`, `currency: "USD"`, 5 rows. | Basic covers a US ETF that is not a demo symbol. |
| T3 | `.../time_series?symbol=VT&interval=1day&outputsize=5` | As T2. | Same, for VT. |
| T4 | `.../time_series?symbol=MSFT&interval=1day&outputsize=5&start_date=2026-10-01` | 200, rows from 2026-10-01. | Date filter works on Basic; how many rows. |
| T5 | `.../eod?symbol=AMZN` | 200 with `close` and `datetime`. | `/eod` is allowed on Basic. |
| T6 | `.../time_series?symbol=VWCE&exchange=XETR&interval=1day&outputsize=2` and `.../time_series?symbol=IWDA&mic_code=XAMS&interval=1day&outputsize=2` | Expected: 403 "upgrade required" (docs table: XETR and XAMS need Grow). If 200 with data, Basic covers them and the chain should move Twelve Data to first place for those exchanges. | Whether Basic covers any European listing despite the exchanges page. |
| T7 | `.../time_series?symbol=AAPL&interval=1day&outputsize=5000` (1 credit) | 200 and the row count. | Real history depth on Basic; the pricing page does not state it. |
| T8 | `.../time_series?symbol=AAPL,MSFT&interval=1day&outputsize=1` | 200; two entries; `api-credits-used` rises by 2. | Comma batch format and credit counting. |
| T9 (deliberate overrun, optional, once) | Send 9 quick calls within one minute | The 9th returns HTTP 429; record the exact `message` text. | The per-minute signal text. [uncertain] today |

### 8.2 EODHD (budget: 20 calls/day; this checklist uses at most 12; do not repeat on the same GMT day)

| # | Call | Passes if | Settles |
|---|---|---|---|
| E1 | `curl -s "https://eodhd.com/api/user?api_token=$EODHD_KEY"` (0 calls) | JSON with plan name and daily limit 20 and remaining calls. | Confirms the free plan limits and per-day counter; may expose the per-minute limit. |
| E2 | `curl -s -D - "https://eodhd.com/api/eod/VTI.US?api_token=$EODHD_KEY&fmt=json&from=2026-10-15"` | 200, rows with `adjusted_close`. | Key works; header `x-ratelimit-remaining`. |
| E3 | `.../api/eod/IWDA.AS?...&from=2026-10-15` | 200 with rows (coverage of Euronext Amsterdam), or 403/402/404 (note the code). | Free plan covers Euronext Amsterdam ETFs and symbol format `.AS`. |
| E4 | `.../api/eod/VWCE.XETRA?...` | As E3. | Xetra ETF and the `.XETRA` suffix. |
| E5 | `.../api/eod/SXR8.XETRA?...` | As E3. | A second Xetra ETF. |
| E6 | `.../api/eod/CSPX.LSE?...` and `.../api/eod/IWDA.LSE?...` | As E3. | London listings (USD) and the `.LSE` suffix. |
| E7 | `.../api/eod/IS3N.XETRA?...` and `.../api/eod/AGGH.XETRA?...` | As E3. | Whether bond and EM funds are served. |
| E8 | `curl -s "https://eodhd.com/api/search/VWCE?api_token=$EODHD_KEY&fmt=json"` (1 call) | JSON list with `Code`, `Exchange`, `Currency`, `ISIN`. | Exact exchange codes (is Euronext Amsterdam `AS`?) and the currency of each listing (the EOD response has no currency field). |
| E9 | `.../api/eod/AAPL.US?...&from=2025-01-01` | Rows begin at about 2025-10-22 (1-year cap). | Free history depth is really 1 year. |
| E10 (optional, last) | Repeat a call after the 20th | HTTP 402 with the text "API Rate Limit Exceeded..." | Quota signal. Do not use if you need calls later that day. |

Record per ticker: HTTP code, row count, last `date`, whether `close` equals the exchange close.

### 8.3 Financial Modeling Prep (budget 250/day; use about 8)

| # | Call | Passes if | Settles |
|---|---|---|---|
| F1 | `curl -s -D - "https://financialmodelingprep.com/stable/historical-price-eod/light?symbol=AAPL&from=2026-10-15&apikey=$FMP_KEY"` | 200 JSON array `[{symbol,date,price,volume}]`. | Key works; the endpoint is on Basic. |
| F2 | `.../stable/historical-price-eod/full?symbol=VTI&from=2026-10-15&apikey=...` | 200 with `close` and `adjClose` fields, or 402/403 "restricted". | US ETF coverage on Basic and the `full` field list. |
| F3 | `.../stable/historical-price-eod/light?symbol=VWCE.DE&...` and `symbol=IWDA.AS` | Expected restricted (402/403). Any data = Basic covers Europe. | Symbol suffix convention and non-US coverage. |
| F4 | `.../stable/historical-price-eod/light?symbol=AAPL&from=2020-01-01&apikey=...` | 5 years or less returned. | History depth on Basic. |
| F5 | the "Stock Batch Quote" endpoint (listed in the pricing matrix; look up its exact path in the FMP docs, not confirmed by me) with `AAPL,MSFT` | 200 or a plan error. | Whether batching exists on Basic and its call cost. |

### 8.4 Alpha Vantage (budget 25/day; use about 5)

| # | Call | Passes if | Settles |
|---|---|---|---|
| A1 | `.../query?function=TIME_SERIES_DAILY&symbol=VTI&apikey=$AV_KEY` | JSON has `Time Series (Daily)`, about 100 rows. | US ETF on the free key. |
| A2 | `.../query?function=TIME_SERIES_DAILY&symbol=VWCE.DEX&apikey=...` and `symbol=IWDA.AMS` | Data = Xetra / Amsterdam coverage. An `Information` or `Error Message` key = not covered. Record the exact text. | Free-plan coverage of European listings. The `.AMS` suffix is not confirmed in the docs I read. [uncertain] |
| A3 | `.../query?function=SYMBOL_SEARCH&keywords=VWCE&apikey=...` | Lists region and currency per match. | Suffixes and trading currency. |
| A4 | Call the same symbol 26 times in one day (optional) | The 26th returns the limit text in an `Information` key. | Exact quota text and reset time. [uncertain] today |

### 8.5 Finnhub (60/min)

| # | Call | Passes if | Settles |
|---|---|---|---|
| H1 | `curl -s "https://finnhub.io/api/v1/quote?symbol=VTI" -H "X-Finnhub-Token: $FINNHUB_KEY"` | `c`, `pc`, `t` present and `t` is the last session. | `/quote` works for a US ETF on the free key. |
| H2 | `.../quote?symbol=VWCE.DE` | Expected `c: 0` or an error (international is not free). | Free key does not serve European listings. |
| H3 | `.../stock/candle?symbol=AAPL&resolution=D&from=1792000000&to=1792600000` | Expected HTTP 403 or an error body (docs label Candles "Premium"). Record the exact text. [uncertain] today | Candles are premium on this key. |

### 8.6 Frankfurter (no key; can be run today)

Done in this research, nothing pending, except: confirm the real publish time by calling `GET https://api.frankfurter.dev/v2/providers/ecb/rates?base=EUR&quotes=USD` at 16:30, 17:00 and 17:30 Athens time on a working day and noting when `date` changes. Compare with "about 16:00 CET".

### 8.7 Decisions the results feed

- If E3 to E7 return data: put EODHD first for European listings; cap European instruments at 16.
- If E3 to E7 and A2 fail: European UCITS ETFs are manual-price only on free tiers; the UI must make "enter price" a first-class action, with a reminder after 7 days.
- If T6 returns data: move Twelve Data first for those exchanges (800 credits/day).
- If T2/T3 fail with 403: US ETFs are not free on Twelve Data; use EODHD (VTI confirmed by demo) and FMP.

## 9. [uncertain] list

1. Twelve Data Basic: history depth (pricing page silent); whether the daily-bar `time_series` for non-demo US ETFs (VT, VTI) works on the free key (docs say US stocks and ETFs are in Basic; only AAPL and QQQ were call-confirmed with the demo key).
2. Twelve Data: terms ambiguity. The pricing page says Basic has "Internal non-display usage" and internal display starts at Grow, while the terms (2.2(b)) allow displaying data to yourself. A private single-user app that shows prices only to its owner is the likely fit, but this is not stated for Basic. Caching timeframes (terms 2.3(g)) were not found.
3. Twelve Data: exact 429 message text; reset zone for the per-minute quota; whether the `api-credits-*` headers appear on every response (not on demo calls). The midnight-UTC daily reset comes from a support article about a year old.
4. EODHD: which exchanges the free plan includes (pricing says "Global" EOD, no list). Per-minute limit on the free plan (pricing page: 20/min; limits page: 1,000/min, no free-specific figure). The exact exchange code for Euronext Amsterdam (`.AS`) and whether free covers LSE, Xetra and Euronext listings. Currency is not in the EOD response.
5. EODHD terms: personal non-commercial use is allowed, but "displaying" is in a restricted list without a definition; whether showing prices in a private single-user app counts is not stated.
6. FMP: exchanges covered on Basic (US-only comes from an old how-to page and the "US Coverage" label on Starter), ETF coverage on Basic, history cap on the Basic column only, batch endpoints on Basic, daily reset zone and the 429 body text, symbol suffix convention for non-US tickers, availability time of EOD data. FMP terms: display needs a licence; a private single-user app is a grey area. No public demo key, so no call was made.
7. Alpha Vantage: per-minute limit and daily reset time on the free key; exact text of the limit message; free-plan coverage of `.LON`/`.DEX` symbols and the Euronext suffix; display and caching rules in the terms (not found in the text I extracted from the PDF).
8. Finnhub: whether `/quote` serves US ETFs on the free key; 429 body text; the 403 message for premium endpoints; no demo key, so no call was made. Daily cap: none stated.
9. Frankfurter: numeric rate limit (not published); whether "16:00 CET" means 16:00 local time all year (CET vs CEST) on both the ECB and Frankfurter pages; the ECB's attribution terms (disclaimer page not opened); v1 end of life date (docs say it will "continue to work", with a deprecation header dated 2026-05-18).
10. Watchlist: free-plan coverage of ALL five UCITS ETFs and of VT; the AMZN CUSIP source (search-result summary of an SEC document, page not opened); Invesco QQQ TER (the page did not expose it); the derived ISINs for VT, VTI, MSFT, AMZN were computed, not read.
11. Refresh timing: provider EOD availability for FMP, Alpha Vantage and Finnhub; trading hours of LSE, Xetra and Euronext (pages did not give them or were not read); holiday calendars for Xetra and LSE; the EU summer-time changeover hour (01:00 UTC) was not on the Commission page I read.
12. Demo keys: EODHD lists two different demo ticker sets on its docs pages, and a live call showed that `MSFT.US` also works with the demo token. The demo set can change at any time, so tests must not depend on it.


## 10. Implementation (Phase 6, 2026-10-23)

How the findings above are used in code. No live call with a provider key has been made (no keys, B-003).

| Topic | Where | Notes |
|---|---|---|
| Exchanges, chain per market, provider symbols, starter list | `src/lib/investing/instruments.ts` | US listings: Twelve Data → EODHD → FMP → Alpha Vantage → Finnhub; Europe: EODHD → Alpha Vantage; other: manual only. Per-instrument `providerSymbols` override the derived symbol. |
| Exchange calendar, expected close, refresh slots | `src/lib/investing/calendar.ts` | NYSE holidays 2026–2027 and Euronext 2026 from section 5.2; slots 07:30 and 12:30 Europe/Athens. |
| Adapters and response mapping | `src/server/market/providers.ts` | Budgets from 7.2 (`PROVIDER_BUDGETS`); mapping in D-056. |
| Budgets and blocks | `src/server/market/budget.ts` | `provider_usage` counters per UTC day and minute, reserved before each call. |
| Chain, negative cache, TTL price cache | `src/server/market/refresh.ts` | `provider_outcomes` (30 days / 1 hour, TTL), `prices` (TTL 400 days after the bar date), `price_meta`. |
| FX | `src/server/market/fx.ts` | `/v2/rates?providers=ECB&base=EUR&quotes=USD,GBP,CHF,JPY`, fallback `/v1/latest`, then the last stored rate with its date. |
| Worker jobs | `src/worker/jobs/market.ts` | Refresh and digest return before any provider is built while no user has the module on (zero-call test). |
| Ranking and split | `src/lib/investing/{metrics,ranking,split}.ts` | PLAN 6.6. |
