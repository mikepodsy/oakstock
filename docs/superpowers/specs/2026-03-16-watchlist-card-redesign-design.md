# Watchlist Card Redesign — Design Spec

## Overview

Redesign the watchlist cards to show richer stock information (company logo, market cap, multi-timeframe performance returns) and add an inline accordion expansion that reveals a price chart, comprehensive financial metrics, company description, and analyst consensus — similar to Yahoo Finance or Seeking Alpha.

## Card Layout (Collapsed)

Each watchlist card displays:

- **Company logo** from Logo.dev API using the company's website domain, with fallback to styled ticker initials
- **Header row**: Logo + ticker symbol + company name + market cap (left), current price + day change % badge (right)
- **Performance pills**: Color-coded badges showing returns for 1M, 3M, YTD, 1Y, 3Y, 5Y — green for positive, red for negative. Show skeleton placeholders while loading. Show `—` for periods with insufficient data (e.g., stock IPO'd 2 years ago → 3Y and 5Y show `—`).
- **Click hint**: Subtle indicator that the card is expandable

### Logo Handling

**Source**: Logo.dev API — `https://img.logo.dev/{domain}?token={key}&size=128`

The company's website domain comes from the `website` field on `QuoteData` (added to `/api/quote` response, sourced from `assetProfile.website` which is already fetched in the existing `quoteSummary` call). This is an optional field — when null/undefined, immediately show the fallback.

**Fallback**: Styled ticker initials in a colored circle. Color is deterministic from a simple hash: sum the char codes of the ticker, mod by a palette of 8 muted colors. Use the first 1-2 characters of the ticker. Same sizing as the logo (56×56px, 12px border radius).

**Error handling**: Use `<img onError>` to swap to the fallback component on any load failure (404, timeout, rate limit). No retry — the fallback is perfectly fine.

## Card Layout (Expanded — Inline Accordion)

Clicking a card expands it in-place, pushing other cards down. Only one card can be expanded at a time. Clicking another card collapses the current one and expands the new. Clicking the already-expanded card collapses it.

**State**: The watchlist page tracks `expandedItemId: string | null`. Passed to each `WatchlistCard` as `isExpanded` boolean + `onToggle` callback.

### Price Chart

A new `StockPriceChart` component — **not** the existing `PerformanceChart` (which is tightly coupled to portfolio data with `portfolioValue`, `benchmarkValue`, `costBasis` fields). `StockPriceChart` is a simpler area chart:

- Single line/area showing the stock's closing price over time
- Time range selector: reuses existing `TimeRangePicker` component as-is (all its ranges including 1D)
- Tooltip showing date + price, using existing `ChartTooltip` component for consistent styling
- Data from existing `/api/history` endpoint
- Green area fill when price trend is up (last close >= first close), red when strictly down

### Key Financials Grid

2-column grid of metric cards:
- P/E Ratio
- EPS (TTM)
- Revenue (TTM) — formatted with `formatCompactNumber` (e.g., "$130.5B")
- Profit Margin — displayed as percentage (e.g., "55.8%")
- 52-Week High — formatted as currency
- 52-Week Low — formatted as currency
- Debt/Equity — displayed as ratio (e.g., "0.41")
- Dividend Yield — displayed as percentage (e.g., "0.02%")

Null values display as "N/A" in muted text.

### About Section

Brief company description from Yahoo Finance's `assetProfile` module. Truncated to ~300 characters with "Show more" toggle if longer.

### Analyst Consensus

Rating label: Strong Buy / Buy / Hold / Sell / Strong Sell (color-coded badge). Average analyst price target with % upside/downside from current price. Hidden entirely if no analyst data is available.

### Loading & Error States

- Show skeleton loaders for the entire detail section while `useFinancials` fetches
- If the fetch fails, show an inline error with a retry button
- Individual sections with null data show "N/A" rather than hiding

## New API Endpoint

### `GET /api/financials?ticker=NVDA`

Hits Yahoo Finance's `quoteSummary` with modules: `defaultKeyStatistics`, `financialData`, `assetProfile`.

**Error handling**: Returns appropriate HTTP status codes matching existing API patterns. If individual modules fail, returns null for those fields rather than failing the entire request. 5-second timeout on the Yahoo Finance call.

**Yahoo Finance field mapping:**

| Response field | Yahoo Finance source |
|---|---|
| `eps` | `defaultKeyStatistics.trailingEps` |
| `revenue` | `financialData.totalRevenue` |
| `profitMargin` | `financialData.profitMargins` |
| `debtToEquity` | `financialData.debtToEquity` |
| `dividendYield` | `defaultKeyStatistics.dividendYield` |
| `volume` | `financialData.volume` (or `price.regularMarketVolume`) |
| `description` | `assetProfile.longBusinessSummary` |
| `analystRating` | `financialData.recommendationKey` (e.g., "strong_buy" → "Strong Buy") |
| `targetPrice` | `financialData.targetMeanPrice` |
| `peRatio` | `defaultKeyStatistics.trailingPE` (fallback: `financialData.currentPrice / financialData.trailingEps`) |
| `website` | `assetProfile.website` — extract domain via `new URL(url).hostname.replace(/^www\./, "")` |
| `fiftyTwoWeekHigh` | `defaultKeyStatistics.fiftyTwoWeekHigh` |
| `fiftyTwoWeekLow` | `defaultKeyStatistics.fiftyTwoWeekLow` |

**`recommendationKey` mapping**: Yahoo returns lowercase strings. Full mapping: `"strong_buy" → "Strong Buy"`, `"buy" → "Buy"`, `"hold" → "Hold"`, `"underperform" → "Underperform"`, `"sell" → "Sell"`, `"strong_sell" → "Strong Sell"`. Unknown values display as-is with title case.

**Analyst rating colors**: Strong Buy / Buy → green (`text-green-primary`), Hold → amber/yellow (`text-yellow-500`), Underperform / Sell / Strong Sell → red (`text-red-primary`).

**Response shape (`FinancialData`):**
```typescript
interface FinancialData {
  ticker: string;
  peRatio: number | null;
  eps: number | null;
  revenue: number | null;
  profitMargin: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  description: string | null;
  analystRating: string | null;
  targetPrice: number | null;
  website: string | null;
}
```

## History API Changes

The existing `/api/history` endpoint needs two new periods added to `getPeriodStartDate`:

| New period | Implementation |
|---|---|
| `ytd` | Start date = January 1st of current year (`new Date(now.getFullYear(), 0, 1)`) |
| `3y` | Start date = `subYears(now, 3)` |

Both use weekly interval (same as existing `1y` and `5y`).

## Performance Returns

**New hook: `usePerformanceReturns(ticker: string, currentPrice: number)`**

Uses `currentPrice` from the already-fetched `QuoteData` (no extra fetch — single source of truth).

Fetches historical close prices for 6 periods using the `/api/history` endpoint. For each period, takes the **first data point's close price** returned by the API as the historical reference (the API already handles non-trading days by returning the nearest available data) and calculates:

```
return = (currentPrice - firstClose) / firstClose * 100
```

**Period → API parameter mapping:**

| Display | API period param |
|---|---|
| 1M | `1m` |
| 3M | `3m` |
| YTD | `ytd` |
| 1Y | `1y` |
| 3Y | `3y` |
| 5Y | `5y` |

Returns a map of `period → percentage | null`. Fetched when the card mounts.

**Edge cases**:
- **Insufficient data**: If a period's history fetch returns empty or errors, return `null` for that period. Card displays `—`.
- **YTD on Jan 1st**: If no trading data exists yet for the year, return `null`.
- **Current price = 0 or null**: Skip calculation, return all nulls.

**Optimization**: Batch the 6 history fetches in parallel with `Promise.all`. Results are cached in component state via `useState` + `useEffect` with ticker as dependency.

**Rate limiting**: Performance returns are fetched per-card on mount. For a watchlist with many stocks, this creates many parallel API calls. Mitigate by: (1) the hook catches errors gracefully and returns `null` for failed periods, and (2) the history API calls are to our own Next.js route which acts as a proxy — Yahoo Finance rate limits affect the server, not the client. If a fetch fails, the pill shows `—` rather than breaking the page.

## New Types

Added to `src/types/index.ts`:

```typescript
interface FinancialData {
  ticker: string;
  peRatio: number | null;
  eps: number | null;
  revenue: number | null;
  profitMargin: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
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

`QuoteData` gets an additional optional field: `website?: string`

## Component Structure

### New Components
- **`StockPriceChart`** — Simple area chart for single-stock price history. Uses Recharts `ComposedChart` + `Area`, existing `TimeRangePicker`, existing `ChartTooltip`, and `/api/history` data. No benchmark, no cost basis.
- **`WatchlistCardDetail`** — The expanded section: stock price chart, financials grid, about, analyst consensus. Rendered conditionally inside `WatchlistCard` when expanded.

### Modified Components
- **`WatchlistCard`** — Complete redesign: logo, header row with market cap, performance pills, expand/collapse behavior
- **`QuoteData` type** — Add optional `website` field so logos work in collapsed view

### Unchanged
- **`WatchlistGrid`** — Still handles responsive grid layout
- **`PerformanceChart`** — Not used here; remains portfolio-only
- **`TimeRangePicker`** — Reused as-is

## Animation

- CSS transition on `max-height` + `opacity` for smooth expand/collapse
- `overflow: hidden` during animation to prevent content flash
- Transition duration: ~300ms ease-in-out
- Respect `prefers-reduced-motion`: disable animations when set

## Accessibility

- Accordion pattern: `aria-expanded` on the card trigger, `aria-controls` pointing to the detail panel
- Keyboard: Enter/Space toggles expand/collapse
- Card is focusable (`tabIndex={0}`)

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/financials/route.ts` | New — financials API endpoint |
| `src/app/api/history/route.ts` | Add `ytd` and `3y` period support |
| `src/app/api/quote/route.ts` | Add `website` field to response (from existing `assetProfile`) |
| `src/types/index.ts` | Add `FinancialData`, `PerformanceReturns` types; add `website?` to `QuoteData` |
| `src/hooks/usePerformanceReturns.ts` | New — hook to compute multi-period returns |
| `src/hooks/useFinancials.ts` | New — hook to fetch financial data for expanded view |
| `src/services/yahooFinance.ts` | Add `fetchFinancials(ticker)` function |
| `src/components/watchlist/WatchlistCard.tsx` | Redesign with logo, performance pills, expand/collapse |
| `src/components/watchlist/WatchlistCardDetail.tsx` | New — expanded detail view |
| `src/components/charts/StockPriceChart.tsx` | New — simple single-stock area chart |
| `src/app/watchlist/page.tsx` | Track expanded card state, pass to cards |

## Environment

- Logo.dev API key stored in `.env` as `NEXT_PUBLIC_LOGO_DEV_TOKEN` (client-side, used in `<img>` src). Free tier available at logo.dev — sign up for a token.
- If the token is missing or invalid, all logos fall back to styled initials immediately
