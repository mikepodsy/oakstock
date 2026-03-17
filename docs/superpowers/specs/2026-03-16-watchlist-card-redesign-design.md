# Watchlist Card Redesign — Design Spec

## Overview

Redesign the watchlist cards to show richer stock information (company logo, market cap, multi-timeframe performance returns) and add an inline accordion expansion that reveals a price chart, comprehensive financial metrics, company description, and analyst consensus — similar to Yahoo Finance or Seeking Alpha.

## Card Layout (Collapsed)

Each watchlist card displays:

- **Company logo** from Logo.dev API using the company's website domain, with fallback to styled ticker initials
- **Header row**: Logo + ticker symbol + company name + market cap (left), current price + day change % badge (right)
- **Performance pills**: Color-coded badges showing returns for 1M, 3M, YTD, 1Y, 3Y, 5Y — green for positive, red for negative
- **Click hint**: Subtle indicator that the card is expandable

## Card Layout (Expanded — Inline Accordion)

Clicking a card expands it in-place, pushing other cards down. Only one card can be expanded at a time. Clicking another card collapses the current one and expands the new. Sections revealed:

### Price Chart
- Reuses the existing `PerformanceChart` component adapted for single-stock mode
- Time range selector: 1W, 1M, 3M, 6M, 1Y, 5Y
- Data from existing `/api/history` endpoint

### Key Financials Grid
2-column grid of metric cards:
- P/E Ratio
- EPS (TTM)
- Revenue (TTM)
- Profit Margin
- 52-Week High
- 52-Week Low
- Debt/Equity
- Dividend Yield

### About Section
- Brief company description from Yahoo Finance's `assetProfile` module

### Analyst Consensus
- Rating label: Strong Buy / Buy / Hold / Sell / Strong Sell
- Average analyst price target with % upside/downside from current price

## New API Endpoint

### `GET /api/financials?ticker=NVDA`

Hits Yahoo Finance's `quoteSummary` with modules: `defaultKeyStatistics`, `financialData`, `assetProfile`, `earnings`.

**Response shape (`FinancialData`):**
```typescript
interface FinancialData {
  ticker: string;
  eps: number | null;              // Trailing twelve months
  revenue: number | null;          // TTM
  profitMargin: number | null;     // As decimal (0.558 = 55.8%)
  debtToEquity: number | null;
  dividendYield: number | null;    // As decimal
  volume: number | null;
  description: string | null;      // Company business summary
  analystRating: string | null;    // e.g. "Strong Buy", "Hold"
  targetPrice: number | null;      // Average analyst target
  website: string | null;          // Company website domain (for logo)
}
```

This keeps the existing `/api/quote` endpoint lean. The financials endpoint is only called when a card is expanded.

## Logo Integration

**Source**: Logo.dev API — `https://img.logo.dev/{domain}?token={key}&size=128`

**Domain resolution**: The company's website URL comes from the `/api/financials` response (`website` field, sourced from Yahoo Finance's `assetProfile.website`). We extract the domain from the URL.

**Fallback chain**:
1. Logo.dev image via company domain
2. Styled ticker initials in a colored circle (deterministic color from ticker hash)

**Caching**: The logo URL is derived from the website domain returned by `/api/financials`. For the collapsed card (before expansion), we use the existing `QuoteData` — we'll add a `website` field to the `/api/quote` response so logos are available without expanding.

## Performance Returns

**New hook: `usePerformanceReturns(ticker: string)`**

Fetches historical close prices for 6 periods (1M, 3M, YTD, 1Y, 3Y, 5Y) using the existing `/api/history` endpoint and calculates percentage returns:

```
return = (currentPrice - historicalClose) / historicalClose * 100
```

Returns a map of `period → percentage`. Fetched when the card mounts. For YTD, fetches from January 1st of the current year.

**Optimization**: Batch the 6 history fetches in parallel with `Promise.all`. Results are cached in component state — no re-fetch on re-render.

## New Types

Added to `src/types/index.ts`:

```typescript
interface FinancialData {
  ticker: string;
  eps: number | null;
  revenue: number | null;
  profitMargin: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  volume: number | null;
  description: string | null;
  analystRating: string | null;
  targetPrice: number | null;
  website: string | null;
}

interface PerformanceReturns {
  '1M': number | null;
  '3M': number | null;
  'YTD': number | null;
  '1Y': number | null;
  '3Y': number | null;
  '5Y': number | null;
}
```

## Component Structure

### Modified Components
- **`WatchlistCard`** — Complete redesign: logo, header row with market cap, performance pills, expand/collapse behavior
- **`QuoteData` type** — Add `website` field so logos work in collapsed view

### New Components
- **`WatchlistCardDetail`** — The expanded section: price chart, financials grid, about, analyst consensus. Rendered conditionally inside `WatchlistCard` when expanded.

### Unchanged
- **`WatchlistGrid`** — Still handles responsive grid layout
- **`PerformanceChart`** — Reused as-is for the price chart in expanded view

## Animation

- CSS transition on `max-height` + `opacity` for smooth expand/collapse
- `overflow: hidden` during animation to prevent content flash
- Transition duration: ~300ms ease-in-out

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/financials/route.ts` | New — financials API endpoint |
| `src/types/index.ts` | Add `FinancialData`, `PerformanceReturns` types; add `website` to `QuoteData` |
| `src/hooks/usePerformanceReturns.ts` | New — hook to compute multi-period returns |
| `src/hooks/useFinancials.ts` | New — hook to fetch financial data for expanded view |
| `src/services/yahooFinance.ts` | Add `fetchFinancials(ticker)` function |
| `src/components/watchlist/WatchlistCard.tsx` | Redesign with logo, performance pills, expand/collapse |
| `src/components/watchlist/WatchlistCardDetail.tsx` | New — expanded detail view |
| `src/app/watchlist/page.tsx` | Track expanded card state, pass to cards |
| `src/app/api/quote/route.ts` | Add `website` field to response |

## Environment

- Logo.dev API key stored in `.env` as `LOGO_DEV_TOKEN`
- No other new environment variables needed
