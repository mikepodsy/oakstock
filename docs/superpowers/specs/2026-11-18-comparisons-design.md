# Comparisons (Relative Valuation) — Design

Date: 2026-11-18 · Branch: `feat/comparisons` (off `feat/backtesting`)

## Goal

A `/comparisons` page modelled on Bloomberg's RV function: enter a ticker, get a
set of comparable companies, and see how they stack up on user-selected metrics
in a comps table and charts. Peers can be added and removed.

## Decisions

- **Peer source:** Claude-picked competitors (structured output), each with a
  one-line reason; every symbol validated against Yahoo; cached 30 days in the
  Supabase table `comp_peers`. Fallback when Claude fails:
  Yahoo `recommendationsBySymbol`, flagged `approximate`.
- **State:** URL only — `?t=NVDA&peers=AMD,AVGO`. No saved peer sets.
- **Metrics:** valuation, growth, profitability/returns, balance sheet/size,
  plus price performance. One registry (`lib/comps/registry.ts`) defines id,
  label, group, format and direction (lower-is-better or higher-is-better).
- **NM handling:** multiples with a non-positive denominator are `null` → shown
  as "NM" and left out of the peer stats.
- **Charts:** ranked bar, scatter with OLS regression (R², implied multiple),
  percentile heatmap on the table, historical P/E against the peer median.
  History is **P/E only** in v1. EV-based history needs historical shares and
  cash, which `company_financials` does not store.

## Architecture

| Unit | Responsibility |
|---|---|
| `lib/fundamentals.ts` | `getFundamentals(ticker)`: the EDGAR→Yahoo→Supabase pipeline, moved out of the `/api/fundamentals` route so comps can reuse it |
| `lib/comps/registry.ts` | Metric definitions, groups and presets |
| `lib/comps/metrics.ts` | Pure: quoteSummary slice + fundamentals + prices → `CompRow` |
| `lib/comps/stats.ts` | Pure: median/mean, percentile rank, OLS regression |
| `lib/comps/history.ts` | Pure: monthly prices + quarterly EPS → TTM P/E series |
| `lib/comps/peers.ts` | Claude prompt and schema, response validation, Supabase cache |
| `api/comps` | `?tickers=` → `CompRow[]` (per-ticker failure becomes an error row) |
| `api/comps/peers` | `?ticker=` → `{ peers: [{ticker, name, reason}], source }` |
| `api/comps/history` | `?ticker=&peers=` → target P/E series and peer-median series |
| `app/comparisons/page.tsx` + `components/comparisons/*` | UI |

## Metric definitions (TTM = sum of the last 4 quarters from fundamentals)

- P/E = price / TTM diluted EPS · Fwd P/E = Yahoo `forwardPE` · PEG = P/E ÷ EPS growth (%)
- P/S = mkt cap / TTM revenue · P/B = Yahoo `priceToBook`
- EV = Yahoo `enterpriseValue` (fallback: mkt cap + debt − cash)
- EV/Sales, EV/EBITDA, EV/EBIT (EBIT = TTM operating income), EV/FCF, P/FCF, FCF yield = FCF / mkt cap
- Growth: revenue, EPS and EBITDA YoY (TTM vs the prior TTM), 3-year revenue and EPS CAGR from annual data
- Margins: gross, operating, net, FCF (TTM) · ROE = TTM NI / equity · ROA = Yahoo
  `returnOnAssets` · ROIC = EBIT·(1−21%) / (debt + equity − cash)
- Net debt/EBITDA, debt/equity, current ratio, mkt cap, EV, 1M/YTD/1Y return

## Errors

Per-ticker failures become a row with `error` set, and the other rows still
render. A failed peer call falls back to Yahoo. An empty peer set shows only the
target row.

## Testing

Vitest unit tests for metrics (including NM), stats, regression, the history
series, and peer validation. They use fixtures, so no live calls run.
