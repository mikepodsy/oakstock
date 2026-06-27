# SEC EDGAR Fundamentals — Design

**Date:** 2026-06-27
**Status:** Approved (brainstorm), ready for implementation plan
**Author:** Mike + Claude

## Problem

Company pages (`/stock/[ticker]`) render financial statement charts — Revenue, EBITDA,
Free Cash Flow, Net Income, EPS, Buybacks & Dividends, Margins, Debt vs Equity — plus a
Key Stats row. These are currently sourced from Yahoo Finance via
`yahoo-finance2`'s `fundamentalsTimeSeries`.

**The limitation:** Yahoo only returns roughly the last ~4–5 years of statement history.
We want deep history. SEC EDGAR's XBRL data goes back to ~2009 (when XBRL became
mandatory for most filers), so it gives far longer Revenue/Income/EPS series for any
company that files with the SEC.

## Goal

Populate the existing financial charts from **SEC EDGAR** as the primary source so users
see long historical series, while keeping every ticker working via a **Yahoo fallback**
for companies EDGAR does not cover (many non-US companies, ADRs, pre-XBRL-only filers).

## Decisions (from brainstorm)

1. **EDGAR is the primary source** for the statement charts, specifically to get
   historical depth Yahoo lacks.
2. **Fall back to Yahoo** when EDGAR has no data for a ticker (no CIK match, or no usable
   XBRL facts). Every ticker keeps working.
3. **Computed metrics leave gaps.** EBITDA, FCF, and margins are derived, not reported.
   When an input line item is missing for a period, that period's bar is simply omitted —
   we do **not** mix in Yahoo values per-field. Source is consistent per ticker.
4. **Caching mirrors the existing pattern** (in-memory `TTLCache` + CDN `s-maxage`).
   No Supabase persistence in this iteration (that is a documented future upgrade).
5. **Margins need no new data field** — `MarginLineChart` already derives gross /
   operating / net margins from `revenue`, `grossProfit`, `operatingIncome`,
   `netIncome`. Populating those fields makes margins work for free.

## Non-Goals

- No Supabase ingestion pipeline / pre-computed store (future Approach C).
- No change to the `FinancialStatement` / `FundamentalsData` types.
- No change to the page, the `useFundamentals` hook, or any chart component.
- No change to the Key Stats row data source in this iteration (it reads from
  `/api/financials`; see "Open question / out of scope" below).

## Architecture

A new self-contained `src/lib/edgar/` module, consumed by a rewritten
`/api/fundamentals` route. The route's public contract (query param, response shape,
cache headers) is unchanged — only its internals change.

```
src/lib/edgar/
  index.ts        # getEdgarFundamentals(ticker) → FundamentalsData | null
  cik.ts          # ticker → CIK (fetches & caches SEC company_tickers.json)
  client.ts       # fetch companyfacts JSON with required User-Agent + rate-limit guard
  concepts.ts     # field → ordered list of candidate us-gaap XBRL tags (synonyms)
  parse.ts        # companyfacts → { quarterly, annual } FinancialStatement[]
  compute.ts      # quarterize cumulative cash-flow facts; derive EBITDA & FCF
```

### Route flow — `src/app/api/fundamentals/route.ts`

```
GET /api/fundamentals?ticker=AAPL
  1. fundamentalsCache.get(ticker)            → hit? return it
  2. getEdgarFundamentals(ticker)
       → FundamentalsData (deep history)  OR  null
  3. if null → existing Yahoo fundamentalsTimeSeries path (unchanged)
  4. fundamentalsCache.set(ticker, data); return with existing CDN headers
```

`getEdgarFundamentals` returns `null` (triggering Yahoo fallback) when:
- the ticker maps to no CIK, OR
- companyfacts fetch fails, OR
- parsing yields zero usable periods (e.g. no Revenue concept found).

The existing `mapStatement` Yahoo logic in the route is preserved verbatim as the
fallback branch.

## EDGAR data access

### Ticker → CIK
SEC publishes `https://www.sec.gov/files/company_tickers.json` — a map of every
ticker to its 10-digit zero-padded CIK. `cik.ts` fetches this once, caches it (long
TTL, e.g. 24h), and resolves tickers case-insensitively. Cache it in a dedicated
`TTLCache` added to `src/lib/cache.ts` (e.g. `edgarCikCache`, 86400s).

### Companyfacts
`https://data.sec.gov/api/xbrl/companyfacts/CIK{10-digit}.json` returns **all** XBRL
facts for a company, grouped as `facts["us-gaap"][concept]["units"][unit][...]`.
Each fact entry has: `start`, `end`, `val`, `fy`, `fp`, `form`, `filed`, `frame?`.

### SEC request requirements (must-haves)
- **`User-Agent` header is mandatory.** SEC rejects requests without a descriptive UA.
  Use e.g. `"Oakstock financial dashboard (podolioukh.michael@gmail.com)"`, read from an
  env var `SEC_USER_AGENT` with a sensible default. Document in `.env.local`.
- **Rate limit: ~10 requests/second.** Our usage is 1–2 fetches per ticker (companyfacts
  + the shared tickers map), so a lightweight guard is enough; no batching needed.
- Companyfacts payloads can be large (1–10 MB). One fetch per ticker, then cached.

## XBRL → FinancialStatement mapping

`concepts.ts` maps each output field to an **ordered list of candidate us-gaap tags**
(tags vary by company and era; first one present per period wins).

| Field | Candidate us-gaap concepts (in priority order) | Type |
|---|---|---|
| `revenue` | `RevenueFromContractWithCustomerExcludingAssessedTax`, `Revenues`, `SalesRevenueNet` | duration |
| `costOfRevenue` | `CostOfGoodsAndServicesSold`, `CostOfRevenue`, `CostOfGoodsSold` | duration |
| `grossProfit` | `GrossProfit` (else `revenue − costOfRevenue`) | duration |
| `operatingIncome` | `OperatingIncomeLoss` | duration |
| `netIncome` | `NetIncomeLoss` | duration |
| `eps` | `EarningsPerShareDiluted` | duration |
| `buybacks` | `PaymentsForRepurchaseOfCommonStock` | duration (cumulative) |
| `dividendsPaid` | `PaymentsOfDividendsCommon`, `PaymentsOfDividends` | duration (cumulative) |
| `totalDebt` | `LongTermDebt`; else `LongTermDebtNoncurrent` + `LongTermDebtCurrent` (+ `ShortTermBorrowings`) | instant |
| `stockholdersEquity` | `StockholdersEquity` | instant |
| `ebitda` | **computed** = `operatingIncome` + D&A | derived |
| `freeCashFlow` | **computed** = operating cash flow − capex | derived |

Computed-metric inputs:
- **D&A:** `DepreciationDepletionAndAmortization`, `DepreciationAmortizationAndAccretionNet`,
  `DepreciationAndAmortization` (first present).
- **Operating cash flow:** `NetCashProvidedByUsedInOperatingActivities`.
- **CapEx:** `PaymentsToAcquirePropertyPlantAndEquipment`,
  `PaymentsToAcquireProductiveAssets`.

`totalDebt` is genuinely approximate in XBRL (no single canonical "total debt" tag).
The candidate ordering above is a best-effort approximation; if nothing resolves, the
field is left `null` (chart bar omitted). This is acceptable per decision #3.

## Parsing logic (`parse.ts` + `compute.ts`) — the hard part

Three real-world XBRL complications must be handled:

### 1. Period classification (duration facts)
Each duration fact has `start`/`end`. Compute `days = end − start`:
- **Single quarter:** `days ≈ 80–100` → a clean 3-month period.
- **Annual / full year:** `days ≈ 350–380`, typically `fp === "FY"`.
- **YTD partials** (≈180d for 6-mo, ≈270d for 9-mo) are kept aside for quarterizing
  cash-flow items (see #3), not shown directly.

Index facts by fiscal period key (`fy` + `fp`, e.g. `2023-Q2`) and by `end` date.

### 2. Restatements / duplicate facts
The same period is re-reported across filings (a 10-K restates earlier quarters). For a
given period + concept there may be multiple `val`s with different `filed` dates. **Pick
the fact with the latest `filed` date** (most recent reported value). This dedupes
restatements deterministically.

### 3. Cumulative → single-quarter (cash-flow & some income items)
Cash-flow statement items (operating cash flow, capex, dividends, buybacks) in 10-Qs are
reported **year-to-date cumulative**, not per-quarter. For a clean quarterly series:
- Q1 YTD = Q1 quarter (use directly).
- Q2 quarter = Q2-YTD (≈180d) − Q1-YTD.
- Q3 quarter = Q3-YTD (≈270d) − Q2-YTD.
- Q4 quarter = FY (≈365d) − Q3-YTD.

Income-statement items: companies usually tag **both** a 3-month and a YTD duration in
10-Qs. Prefer the native 3-month fact when present; only fall back to subtraction when it
isn't. Instant facts (`totalDebt`, `stockholdersEquity`) need no period math — take the
value at each period-end date.

### Output assembly
- Build `quarterly: FinancialStatement[]` keyed by fiscal-quarter end date, and
  `annual: FinancialStatement[]` keyed by fiscal-year end date.
- `date` field = ISO string of the period `end` (matches the existing Yahoo shape).
- Each field is filled where resolvable, else `null` → chart simply skips that bar.
- Compute `ebitda` and `freeCashFlow` **after** per-quarter values are assembled, so the
  derived metrics use already-quarterized inputs. If any input is `null`, the derived
  value is `null` (gap), per decision #3.
- Sort ascending by date (matches existing route behavior).
- Optionally trim to a sane floor (e.g. drop pre-2009 noise); default: keep all.

## Caching

- `fundamentalsCache` (existing, 3600s TTL, keyed by ticker) wraps the **final**
  `FundamentalsData`, regardless of source — same as today.
- New `edgarCikCache` (24h) for the shared ticker→CIK map.
- Existing CDN response header (`s-maxage=3600, stale-while-revalidate=3600`) is kept.
- Companyfacts JSON itself is fetched per request-miss; the assembled result is what's
  cached, so large payloads aren't re-fetched within the TTL window.

## Error handling

| Failure | Behavior |
|---|---|
| Ticker has no CIK | `getEdgarFundamentals` → `null` → Yahoo fallback |
| companyfacts 404 / network error | `null` → Yahoo fallback |
| SEC rejects (missing UA / rate limit 429) | `null` → Yahoo fallback; log warning |
| Parse yields 0 usable periods | `null` → Yahoo fallback |
| Yahoo fallback also fails | existing route 500 behavior (unchanged) |

EDGAR failures are **non-fatal** — they degrade gracefully to the current behavior, so
this change cannot make any ticker worse than today.

## Testing

- **`parse.ts` / `compute.ts` are pure functions** over a companyfacts JSON object —
  unit-test them with saved fixtures (no network). Cover:
  - quarter classification by day-count,
  - restatement dedupe (latest `filed` wins),
  - cumulative → single-quarter subtraction (Q2/Q3/Q4),
  - computed EBITDA/FCF with present inputs, and `null` when an input is missing,
  - concept synonym fallback (e.g. `Revenues` vs `RevenueFromContractWith...`).
- Save 2–3 real companyfacts fixtures under `.tmp/` or a test fixtures dir:
  one modern filer (AAPL), one with synonym-era tags (older filer), one non-SEC ticker
  (expect `null` → fallback).
- **`cik.ts` / `client.ts`** are thin network wrappers — smoke-test against live SEC once
  during dev; not part of the unit suite.
- Manual verification: load `/stock/AAPL` and confirm Revenue/Net Income/EPS now show
  ~15 years of bars vs the old ~5, and a non-US ticker still renders via Yahoo.

## Open question / out of scope

The **Key Stats row** (P/E, EPS TTM, Div Yield, Debt/Equity, etc.) reads from
`/api/financials`, a separate Yahoo-backed endpoint. This design intentionally does
**not** touch it — those are mostly point-in-time/ratio stats where Yahoo is fine. A
follow-up could source Debt/Equity from the EDGAR balance-sheet data we now parse.

## Future upgrade (Approach C, not now)

If on-demand parsing proves too slow at scale, move ingestion into a `tools/` script that
writes parsed `FinancialStatement` rows into a Supabase table on a schedule, and have the
route read from the DB. The `lib/edgar/` parser built here is reused as-is.
