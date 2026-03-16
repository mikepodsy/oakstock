# Phase 3: Charts & Visualization — Design Spec

## Goal

Add interactive charts to the portfolio detail page and dashboard: a performance area chart with benchmark overlay, allocation donut, sector breakdown, mini sparklines on dashboard cards, and a combined portfolio chart on the dashboard.

## Decisions

- **Sector data**: Upgrade `/api/quote` and `/api/quotes` to use `quoteSummary` for real sector data from Yahoo Finance.
- **Historical data**: Accurate per-holding approach. Fetch historical prices for each holding individually, multiply by shares, sum by date.
- **Data architecture**: Single `usePortfolioHistory` hook fetches and aggregates all historical data. Charts are pure display components.
- **Loading**: Eager fetch on page mount. No lazy loading.

---

## 1. API Changes

### Upgrade `/api/quote/route.ts`

Replace `yahooFinance.quote(ticker)` with `yahooFinance.quoteSummary(ticker, { modules: ['price', 'summaryProfile'] })`. Map `summaryProfile.sector` into the response's `sector` field. All other response fields remain the same, mapped from the `price` module instead of the `quote` result.

### Upgrade `/api/quotes/route.ts`

Same change: use `quoteSummary` per ticker instead of `quote`. Each ticker in the batch gets the sector field populated.

### No changes to `/api/history` or `/api/search`

These routes are already sufficient for Phase 3.

---

## 2. New Types

Add to `src/types/index.ts`:

```typescript
interface PortfolioChartPoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number | null;
  costBasis: number;
}
```

---

## 3. New Hook: `usePortfolioHistory`

**File**: `src/hooks/usePortfolioHistory.ts`

**Inputs**:
- `holdings: { ticker: string; shares: number }[]` — ticker + total shares per holding
- `benchmark: string` — benchmark ticker (e.g. "SPY")
- `period: string` — time range (1w, 1m, 3m, 6m, 1y, max)
- `totalCost: number` — total cost basis for the horizontal line

**Behavior**:
1. Fetch historical data for all holding tickers + the benchmark ticker in parallel via `Promise.allSettled` using `fetchHistory` from the yahoo finance service.
2. Align dates across all tickers (use intersection of available dates).
3. For each date: `portfolioValue = sum(holding.shares * historicalClose[ticker][date])`.
4. Normalize benchmark: `benchmarkNormalized[date] = benchmarkClose[date] / benchmarkClose[firstDate] * portfolioValue[firstDate]`.
5. Cost basis is a constant horizontal line at `totalCost`.

**Returns**: `{ data: PortfolioChartPoint[], loading: boolean, error: string | null }`

**Caching**: Re-fetches when `holdings`, `benchmark`, or `period` changes (key derived from sorted tickers + period).

---

## 4. New Utility: `fetchHistory` service method

Already exists in `src/services/yahooFinance.ts` as `fetchHistory(ticker, period)`. No changes needed.

---

## 5. Chart Components

All in `src/components/charts/`.

### 5a. `ChartTooltip.tsx`

Shared custom tooltip for Recharts. Dark background (`bg-elevated`), `border-primary` border, `rounded-lg`. Date in `text-tertiary`, values in `font-financial text-primary`. Color-coded labels for each line. Reused across PerformanceChart, CombinedChart, and AllocationDonut.

### 5b. `TimeRangePicker.tsx`

Row of pill buttons for selecting time range: 1W | 1M | 3M | 6M | 1Y | ALL. Active pill: `bg-green-primary text-white`. Inactive: `bg-transparent border border-border-primary text-text-secondary hover:text-text-primary`. Calls `onSelect(period)` on click. Rendered above charts, right-aligned.

### 5c. `PerformanceChart.tsx`

**Used on**: Portfolio detail page.

Recharts `ComposedChart` inside `ResponsiveContainer` (width 100%, height 400px desktop / 250px mobile).

Elements:
- `<Area>` for portfolio value: `stroke: var(--green-primary)`, `strokeWidth: 2`, fill with `<linearGradient>` from green at 20% opacity to transparent.
- `<Line>` for benchmark: `stroke: var(--oak-300)`, `strokeWidth: 1.5`, `strokeDasharray: "6 4"`, no fill.
- `<ReferenceLine>` for cost basis: `stroke: var(--text-tertiary)`, `strokeDasharray: "4 4"`, `strokeWidth: 1`.
- `<XAxis>`: `tick: var(--text-tertiary)`, `fontSize: 12`, font-financial. Formatted dates (e.g. "Mar 16").
- `<YAxis>`: `tick: var(--text-tertiary)`, `fontSize: 12`, font-financial. Formatted as `$XX,XXX`.
- `<CartesianGrid>`: `strokeDasharray: "3 3"`, `stroke: var(--border-primary)`.
- `<Tooltip>`: Custom `ChartTooltip` showing date, portfolio value, benchmark value, difference.
- Animation: `isAnimationActive={true}`, `animationDuration={800}`.

Legend below chart: three items — "Portfolio" (green dot), benchmark name (oak dot), "Cost Basis" (gray dashed line).

**Props**: `data: PortfolioChartPoint[]`, `benchmarkName: string`, `period: string`, `onPeriodChange: (period: string) => void`, `loading: boolean`.

Loading state: skeleton rectangle matching chart dimensions with shimmer animation. Time range pills are visible and interactive during loading.

Error state: centered "Unable to load chart data" with a retry button inside the chart area.

### 5d. `CombinedChart.tsx`

**Used on**: Dashboard page.

Same structure as PerformanceChart but simpler: single green `<Area>` only (no benchmark, no cost basis). Height 350px desktop / 250px mobile. Includes `TimeRangePicker`.

**Props**: `data: { date: string; value: number }[]`, `period: string`, `onPeriodChange: (period: string) => void`, `loading: boolean`.

### 5e. `AllocationDonut.tsx`

**Used on**: Portfolio detail page.

Recharts `PieChart` with `<Pie innerRadius={60} outerRadius={100}>`. Each slice is a holding sized by `marketValue`.

Color palette: generate N colors stepping from `var(--chart-1)` through `var(--chart-2)` to `var(--chart-5)` using the existing CSS chart variables, cycling if more holdings than colors.

Labels outside each slice: `TICKER XX%` in `font-financial text-xs`.

Center custom label: total portfolio value in `font-financial text-lg text-primary`.

**Props**: `holdings: { ticker: string; marketValue: number }[]`, `totalValue: number`.

### 5f. `SectorBreakdown.tsx`

**Used on**: Portfolio detail page.

Recharts `BarChart` with `layout="vertical"`. Groups holdings by `sector` field (from quote data), sums market value per sector, calculates percentage of total. Sorted descending by value.

Bars use the chart color palette. Y-axis shows sector names in `text-secondary text-xs`. Each bar has a label on the right showing the percentage.

Height: dynamic, ~40px per sector row.

**Props**: `holdings: { sector: string | undefined; marketValue: number }[]`, `totalValue: number`.

Holdings with `sector: undefined` are grouped as "Unknown".

### 5g. `Sparkline.tsx`

**Used on**: Dashboard PortfolioCard.

Recharts `LineChart` — 120px wide, 40px tall. No axes, no grid, no tooltip, no labels.

Line: `strokeWidth: 1.5`. Green (`var(--green-primary)`) if the last value >= first value, red (`var(--red-primary)`) otherwise.

**Props**: `data: number[]` (just the values array), `className?: string`.

---

## 6. Page Integration

### Portfolio Detail Page (`/portfolio/[id]/page.tsx`)

New layout order:
1. `PortfolioHeader`
2. `PerformanceSummaryBar`
3. `PerformanceChart` (full width) — fed by `usePortfolioHistory` with the portfolio's holdings, benchmark, and selected period
4. "Holdings" heading + "Add Holding" button
5. Two-column grid (desktop) / stacked (mobile):
   - Left (~60%): `HoldingsTable`
   - Right (~40%): `AllocationDonut` then `SectorBreakdown` stacked

The page manages `period` state and passes it to `usePortfolioHistory` and `PerformanceChart`.

### Dashboard Page (`/page.tsx`)

New layout order:
1. `PortfolioSummaryCards`
2. `CombinedChart` (full width) — fed by `usePortfolioHistory` with all holdings across all portfolios combined
3. `PortfolioGrid` — each `PortfolioCard` now includes a `Sparkline`

For sparklines: the dashboard page fetches 1-month history for all tickers once. Each `PortfolioCard` receives pre-computed sparkline data (array of daily portfolio values for that specific portfolio) as a prop. The aggregation happens in the dashboard page using the same date-alignment logic from `usePortfolioHistory`.

### PortfolioCard changes

Add a `sparklineData?: number[]` prop. When provided, render `<Sparkline data={sparklineData} />` at the bottom of the card, below the holdings count.

---

## 7. File Summary

### New Files (8)
| File | Purpose |
|------|---------|
| `src/hooks/usePortfolioHistory.ts` | Fetch + aggregate historical data for a portfolio |
| `src/components/charts/ChartTooltip.tsx` | Shared custom Recharts tooltip |
| `src/components/charts/TimeRangePicker.tsx` | Time range pill selector |
| `src/components/charts/PerformanceChart.tsx` | Main area chart with benchmark overlay |
| `src/components/charts/CombinedChart.tsx` | Dashboard combined portfolio chart |
| `src/components/charts/AllocationDonut.tsx` | Holdings allocation pie chart |
| `src/components/charts/SectorBreakdown.tsx` | Sector allocation bar chart |
| `src/components/charts/Sparkline.tsx` | Mini 30-day sparkline |

### Modified Files (5)
| File | Change |
|------|--------|
| `src/app/api/quote/route.ts` | Use `quoteSummary` for sector data |
| `src/app/api/quotes/route.ts` | Use `quoteSummary` for sector data |
| `src/app/portfolio/[id]/page.tsx` | Add PerformanceChart, AllocationDonut, SectorBreakdown |
| `src/app/page.tsx` | Add CombinedChart, pass sparkline data to PortfolioGrid |
| `src/components/dashboard/PortfolioCard.tsx` | Add Sparkline rendering |
| `src/types/index.ts` | Add `PortfolioChartPoint` type |
