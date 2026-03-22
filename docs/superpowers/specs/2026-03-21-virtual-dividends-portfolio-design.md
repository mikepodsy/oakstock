# Virtual Dividends Portfolio — Design Spec

## Problem

Dividend data is scattered across the app — yield shows on individual stock pages, the calendar shows market-wide upcoming dividends, but there's no centralized view of "all my dividend stocks" with income tracking and metrics. Users who hold dividend-paying stocks have no way to track their dividend income or see their portfolio's dividend characteristics at a glance.

## Solution

A dedicated `/dividends` page that acts as a **virtual portfolio** — aggregating all dividend-paying holdings from all portfolios in real-time. No database changes; purely a read-only computed view.

**Detection:** A stock is a dividend stock if Yahoo Finance reports `dividendYield > 0` OR `dividendRate > 0` (dual check to handle edge cases where yield temporarily shows 0 after ex-dividend).

## Architecture

### Data Flow

```
Page Load
  ├─ usePortfolioStore → all holdings across portfolios
  ├─ useDividendHoldings hook
  │    ├─ Extract unique tickers
  │    ├─ GET /api/financials/batch?tickers=... (chunks of 20)
  │    ├─ Filter holdings where dividendYield > 0 OR dividendRate > 0
  │    └─ Return enriched DividendHolding[]
  ├─ useDividendIncome hook (depends on useDividendHoldings)
  │    ├─ GET /api/dividends/income?tickers=...&from=...
  │    ├─ Filter payments after each holding's earliest lot purchase date
  │    ├─ Multiply each payment by current total shares (simplified)
  │    └─ Aggregate by month → MonthlyIncome[]
  └─ useCalendar("dividends", now, now+30days) (existing hook)
       └─ Upcoming dividend calendar events
```

### Key Principle: Virtual Aggregation

The Dividends page does not create a real portfolio in Supabase. It reads all existing portfolios from the Zustand store, enriches holdings with dividend data from Yahoo Finance and FMP, and presents a computed view. This means:

- Holdings always stay in sync with their source portfolios
- No data duplication or sync issues
- Deleting a stock from a portfolio automatically removes it from the dividends view

### Historical Income Simplification

For dividend income calculations, we use the **earliest lot purchase date** per ticker and multiply historical payments by **current total shares**. This is a simplification — it doesn't track exact share count at each payment date. Acceptable for an overview page; precision tracking would require lot-level ownership history which is out of scope.

## Types

```typescript
interface DividendHolding {
  holdingId: string;
  portfolioId: string;
  portfolioName: string;
  ticker: string;
  name: string;
  currency: "CAD" | "USD";
  totalShares: number;
  avgCostBasis: number;
  currentPrice: number;
  dividendYield: number;           // Current yield from Yahoo Finance
  annualDividendPerShare: number;  // Yahoo Finance dividendRate field
  annualIncome: number;            // annualDividendPerShare × totalShares
  yieldOnCost: number;             // annualDividendPerShare ÷ avgCostBasis
}

interface DividendPayment {
  symbol: string;                  // Matches DividendEvent naming
  date: string;
  dividend: number;                // Per share amount (matches DividendEvent)
  totalReceived: number;           // dividend × totalShares at time of query
}

interface MonthlyIncome {
  month: string;                   // Format: "2024-03"
  totalIncome: number;
  byTicker: { ticker: string; amount: number }[];
}
```

## API Endpoints

### `GET /api/financials/batch?tickers=AAPL,KO,JNJ`

Batch version of the existing `/api/financials` endpoint. Processes tickers in chunks of 20 with 200ms delay between chunks to respect Yahoo Finance rate limits. For each ticker, calls Yahoo Finance `quoteSummary` and returns dividend-relevant fields:

```json
[
  { "ticker": "KO", "dividendYield": 0.031, "dividendRate": 1.94, "currentPrice": 62.5 },
  { "ticker": "JNJ", "dividendYield": 0.029, "dividendRate": 4.76, "currentPrice": 164.0 }
]
```

**Cache:** 15-minute TTL (matches existing financials pattern). Individual ticker results are cached, so subsequent requests skip already-cached tickers.

**Error handling:** If a ticker fails, return `null` for its fields and include it in the response with `error: true`. The page shows a warning indicator on that row but continues displaying the rest.

### `GET /api/dividends/income?tickers=KO,JNJ&from=2024-01-01`

Fetches historical dividend payments from FMP for the given tickers since the `from` date. Maximum lookback: 10 years from today.

```json
{
  "KO": [
    { "date": "2025-03-14", "dividend": 0.485 },
    { "date": "2024-12-13", "dividend": 0.485 }
  ],
  "JNJ": [
    { "date": "2025-02-24", "dividend": 1.24 }
  ]
}
```

**Cache:** 24-hour TTL (historical dividend data changes very rarely).

Uses FMP's `historical-price-full/stock_dividend/{ticker}` endpoint. Follows existing FMP integration pattern from `/api/calendar/[type]/route.ts`.

## Page Layout

### Empty State

When the user has no dividend-paying holdings across any portfolio, show a centered message:
> "No dividend-paying stocks in your portfolios yet. Add stocks like KO, JNJ, or O to start tracking dividend income."

### 1. Summary Cards (top row, 4 cards)

| Card | Value | Calculation |
|------|-------|-------------|
| Est. Annual Income | Dollar amount | Sum of (annualDividendPerShare × totalShares) across all dividend holdings |
| Avg. Portfolio Yield | Percentage | Weighted average: total annual income ÷ total market value of dividend holdings |
| Dividend Holdings | Count | Number of unique holdings with dividendYield > 0 |
| Next Payment | Date + ticker | Nearest upcoming ex-date from calendar data for portfolio stocks. Format: "Mar 25 (KO)" or "None scheduled" if empty |

### 2. Holdings Table

Sortable table. Default sort: Annual Income descending.

| Column | Source |
|--------|--------|
| Ticker | Portfolio store |
| Name | Portfolio store |
| Portfolio | Source portfolio name |
| Shares | Sum of lots |
| Current Price | Yahoo quote |
| Div Yield | Yahoo financials batch (dividendYield) |
| Annual Div/Share | Yahoo financials batch (dividendRate) |
| Annual Income | dividendRate × totalShares |
| Yield on Cost | dividendRate ÷ avgCostBasis |

Clicking a row navigates to `/stock/[ticker]`.

### 3. Income History Chart

- Recharts bar chart (matches existing chart patterns in the app)
- X-axis: months, Y-axis: dividend income received ($)
- Data: historical dividends from FMP, filtered to after earliest purchase date per ticker, multiplied by current total shares
- Toggle: monthly vs quarterly aggregation (quarterly sums 3 months into one bar)
- All amounts shown in original currency (no conversion). Mixed USD/CAD portfolios show combined total.

### 4. Upcoming Dividends

- Reuses existing `DividendTable` component from `src/components/calendar/DividendTable.tsx`
- Filters to portfolio stocks only (`isPortfolioStock: true`)
- Shows next 30 days of upcoming ex-dates and payment dates

## UI States

### Loading
- Initial load: Skeleton cards (4 placeholders) and 5 skeleton table rows
- Income data (slower): Shows holdings table first, chart loads independently with its own skeleton

### Errors
- Partial ticker failure: Show data for successful tickers, dim row for failed ones with tooltip "Unable to load dividend data"
- Complete API failure: Error banner with retry button above the page content
- FMP income failure: Show holdings table and cards normally, replace chart with "Unable to load income history" message

## Navigation

Add `{ href: "/dividends", label: "Dividends" }` to the `NAV_LINKS` array in `src/components/layout/Navbar.tsx`, positioned between "Calendar" and "DCF". Always visible (not conditional on having dividend holdings).

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/dividends/page.tsx` | Main page component |
| `src/app/api/financials/batch/route.ts` | Batch financials API |
| `src/app/api/dividends/income/route.ts` | Historical dividend income API |
| `src/hooks/useDividendHoldings.ts` | Hook to identify and enrich dividend holdings |
| `src/hooks/useDividendIncome.ts` | Hook to fetch and aggregate income history |
| `src/components/dividends/DividendSummaryCards.tsx` | Summary metrics cards |
| `src/components/dividends/DividendHoldingsTable.tsx` | Main holdings table |
| `src/components/dividends/DividendIncomeChart.tsx` | Income bar chart |
| `src/components/dividends/UpcomingDividends.tsx` | Upcoming payments section |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/layout/Navbar.tsx` | Add "Dividends" nav link |
| `src/types/index.ts` | Add `DividendHolding`, `DividendPayment`, `MonthlyIncome` interfaces |
| `src/services/yahooFinance.ts` | Add `fetchBatchFinancials()` and `fetchDividendIncome()` functions |

## Verification

1. Add a known dividend stock (KO, JNJ, T) to any portfolio → appears on /dividends page with correct yield and income estimate
2. Add a non-dividend stock (AMZN, GOOG) → does NOT appear
3. Income history chart shows payments since purchase date, multiplied by shares
4. Upcoming calendar shows next ex-dates for portfolio stocks only
5. Multiple portfolios aggregate correctly with source portfolio name shown
6. Empty state shows when no dividend stocks exist
7. Page handles partial API failures gracefully (some tickers fail, others show)
8. `npm run build` passes with no type errors
