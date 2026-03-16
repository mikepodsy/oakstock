# Phase 3: Charts & Visualization — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive charts (performance area, allocation donut, sector breakdown, sparklines) to the portfolio detail page and dashboard.

**Architecture:** Upgrade quote APIs to use `quoteSummary` for real sector data. Create a `usePortfolioHistory` hook that fetches per-holding historical data and aggregates it into chart-ready points. Build 7 pure Recharts display components. Integrate into existing pages.

**Tech Stack:** Recharts 3.8.0, yahoo-finance2 (`quoteSummary`), Zustand, Tailwind CSS v4 custom properties, date-fns

---

## Chunk 1: API Upgrades & Types

### Task 1: Add `PortfolioChartPoint` type

**Files:**
- Modify: `src/types/index.ts:73` (after `HistoricalDataPoint`)

- [ ] **Step 1: Add the type**

Add after the `HistoricalDataPoint` interface (line 76):

```typescript
export interface PortfolioChartPoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number | null;
  costBasis: number;
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/michaelpodolioukh/Oakstock && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds (or at least no type errors related to this change)

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add PortfolioChartPoint interface for chart data"
```

---

### Task 2: Upgrade `/api/quote` to use `quoteSummary`

**Files:**
- Modify: `src/app/api/quote/route.ts` (full rewrite of the GET handler)

- [ ] **Step 1: Rewrite the route handler**

Replace the entire contents of `src/app/api/quote/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Try quoteSummary first for sector data
    try {
      const summary = await yf.quoteSummary(ticker, {
        modules: ["price", "assetProfile"],
      });

      const price = summary.price;
      const profile = summary.assetProfile;

      return NextResponse.json({
        ticker: price?.symbol ?? ticker,
        name: price?.shortName ?? price?.longName ?? ticker,
        currentPrice: price?.regularMarketPrice ?? 0,
        previousClose: price?.regularMarketPreviousClose ?? 0,
        dayChange: price?.regularMarketChange ?? 0,
        dayChangePercent: price?.regularMarketChangePercent
          ? price.regularMarketChangePercent * 100
          : 0,
        marketCap: price?.marketCap ?? undefined,
        peRatio: undefined,
        fiftyTwoWeekHigh: undefined,
        fiftyTwoWeekLow: undefined,
        sector: profile?.sector ?? undefined,
        currency: price?.currency ?? "USD",
      });
    } catch {
      // Fallback to quote() for indices and tickers that don't support quoteSummary
      const result = await yf.quote(ticker);

      return NextResponse.json({
        ticker: result.symbol,
        name: result.shortName ?? result.longName ?? result.symbol,
        currentPrice: result.regularMarketPrice ?? 0,
        previousClose: result.regularMarketPreviousClose ?? 0,
        dayChange: result.regularMarketChange ?? 0,
        dayChangePercent: result.regularMarketChangePercent ?? 0,
        marketCap: result.marketCap ?? undefined,
        peRatio: result.trailingPE ?? undefined,
        fiftyTwoWeekHigh: result.fiftyTwoWeekHigh ?? undefined,
        fiftyTwoWeekLow: result.fiftyTwoWeekLow ?? undefined,
        sector: undefined,
        currency: result.currency ?? "USD",
      });
    }
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch quote for ${ticker}` },
      { status: 500 }
    );
  }
}
```

**Key notes:**
- `quoteSummary` returns `regularMarketChangePercent` as a decimal (e.g., 0.025 for 2.5%), so we multiply by 100
- The `price` module does NOT include `trailingPE`, `fiftyTwoWeekHigh`, `fiftyTwoWeekLow` — set to `undefined` when using quoteSummary path
- The fallback `quote()` path preserves the existing behavior exactly

- [ ] **Step 2: Verify the route works**

Run: `cd /Users/michaelpodolioukh/Oakstock && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test**

Start the dev server if not running. In a separate terminal:
```bash
curl "http://localhost:3000/api/quote?ticker=AAPL" 2>/dev/null | python3 -m json.tool
```
Expected: JSON response with `sector` field populated (e.g., "Technology")

```bash
curl "http://localhost:3000/api/quote?ticker=^GSPC" 2>/dev/null | python3 -m json.tool
```
Expected: JSON response with `sector: null` (index fallback path)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/quote/route.ts
git commit -m "feat(api): upgrade /api/quote to quoteSummary for sector data"
```

---

### Task 3: Upgrade `/api/quotes` to use `quoteSummary`

**Files:**
- Modify: `src/app/api/quotes/route.ts` (rewrite the mapping logic)

- [ ] **Step 1: Rewrite the route handler**

Replace the entire contents of `src/app/api/quotes/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

async function fetchSingleQuote(ticker: string) {
  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ["price", "assetProfile"],
    });

    const price = summary.price;
    const profile = summary.assetProfile;

    return {
      ticker: price?.symbol ?? ticker,
      name: price?.shortName ?? price?.longName ?? ticker,
      currentPrice: price?.regularMarketPrice ?? 0,
      previousClose: price?.regularMarketPreviousClose ?? 0,
      dayChange: price?.regularMarketChange ?? 0,
      dayChangePercent: price?.regularMarketChangePercent
        ? price.regularMarketChangePercent * 100
        : 0,
      marketCap: price?.marketCap ?? undefined,
      peRatio: undefined,
      fiftyTwoWeekHigh: undefined,
      fiftyTwoWeekLow: undefined,
      sector: profile?.sector ?? undefined,
      currency: price?.currency ?? "USD",
    };
  } catch {
    // Fallback to quote() for indices and unsupported tickers
    const result = await yf.quote(ticker);
    return {
      ticker: result.symbol,
      name: result.shortName ?? result.longName ?? result.symbol,
      currentPrice: result.regularMarketPrice ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      dayChange: result.regularMarketChange ?? 0,
      dayChangePercent: result.regularMarketChangePercent ?? 0,
      marketCap: result.marketCap ?? undefined,
      peRatio: result.trailingPE ?? undefined,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh ?? undefined,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow ?? undefined,
      sector: undefined,
      currency: result.currency ?? "USD",
    };
  }
}

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");

  if (!tickersParam) {
    return NextResponse.json(
      { error: "tickers parameter is required" },
      { status: 400 }
    );
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "at least one ticker is required" },
      { status: 400 }
    );
  }

  try {
    const results = await Promise.allSettled(
      tickers.map((t) => fetchSingleQuote(t))
    );

    const quotes = results
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchSingleQuote>>> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value);

    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/michaelpodolioukh/Oakstock && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/quotes/route.ts
git commit -m "feat(api): upgrade /api/quotes to quoteSummary for sector data"
```

---

## Chunk 2: Data Hook

### Task 4: Create `usePortfolioHistory` hook

**Files:**
- Create: `src/hooks/usePortfolioHistory.ts`

- [ ] **Step 1: Create the hook file**

Create `src/hooks/usePortfolioHistory.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PortfolioChartPoint } from "@/types";
import { fetchHistory } from "@/services/yahooFinance";

interface HoldingInput {
  ticker: string;
  shares: number;
}

const VALID_PERIODS = ["1w", "1m", "3m", "6m", "1y", "max"];

export function usePortfolioHistory(
  holdings: HoldingInput[],
  benchmark: string,
  period: string,
  totalCost: number
) {
  const [data, setData] = useState<PortfolioChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validPeriod = VALID_PERIODS.includes(period) ? period : "1y";

  // Stable key for dependency tracking
  const holdingsKey = useMemo(
    () =>
      holdings
        .map((h) => `${h.ticker}:${h.shares}`)
        .sort()
        .join(","),
    [holdings]
  );

  const fetchData = useCallback(async () => {
    if (holdings.length === 0) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all holding histories + benchmark in parallel
      const tickers = holdings.map((h) => h.ticker);
      const allTickers = [...tickers, benchmark];

      const results = await Promise.allSettled(
        allTickers.map((t) => fetchHistory(t, validPeriod))
      );

      // Build lookup: ticker -> { date -> close }
      const historyMap: Record<string, Record<string, number>> = {};
      for (let i = 0; i < allTickers.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          const map: Record<string, number> = {};
          for (const point of result.value) {
            map[point.date] = point.close;
          }
          historyMap[allTickers[i]] = map;
        }
      }

      // Collect all unique dates (union approach)
      const dateSet = new Set<string>();
      for (const ticker of tickers) {
        const tickerHistory = historyMap[ticker];
        if (tickerHistory) {
          for (const date of Object.keys(tickerHistory)) {
            dateSet.add(date);
          }
        }
      }

      const sortedDates = Array.from(dateSet).sort();

      if (sortedDates.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Build portfolio value per date
      const benchmarkHistory = historyMap[benchmark];
      const firstDate = sortedDates[0];
      const firstBenchmarkClose = benchmarkHistory?.[firstDate];

      // Compute baseline once (first date's portfolio value for benchmark normalization)
      let firstPortfolioValue = 0;
      for (const h of holdings) {
        const close = historyMap[h.ticker]?.[firstDate];
        if (close !== undefined) {
          firstPortfolioValue += h.shares * close;
        }
      }
      const baseline =
        firstPortfolioValue > 0 ? firstPortfolioValue : totalCost;

      const points: PortfolioChartPoint[] = sortedDates.map((date) => {
        // Sum holding values for this date
        let portfolioValue = 0;
        for (const h of holdings) {
          const close = historyMap[h.ticker]?.[date];
          if (close !== undefined) {
            portfolioValue += h.shares * close;
          }
        }

        // Normalize benchmark to portfolio scale
        let benchmarkValue: number | null = null;
        if (benchmarkHistory && firstBenchmarkClose) {
          const benchClose = benchmarkHistory[date];
          if (benchClose !== undefined) {
            benchmarkValue =
              (benchClose / firstBenchmarkClose) * baseline;
          }
        }

        return {
          date,
          portfolioValue,
          benchmarkValue,
          costBasis: totalCost,
        };
      });

      setData(points);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch history"
      );
      setData([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingsKey, benchmark, validPeriod, totalCost]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/michaelpodolioukh/Oakstock && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePortfolioHistory.ts
git commit -m "feat(hooks): add usePortfolioHistory for chart data aggregation"
```

---

## Chunk 3: Shared Chart Components

### Task 5: Create `ChartTooltip` component

**Files:**
- Create: `src/components/charts/ChartTooltip.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/charts/ChartTooltip.tsx`:

```typescript
"use client";

import { formatCurrency, formatDate } from "@/utils/formatters";

interface TooltipEntry {
  name: string;
  value: number | null;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  entries: TooltipEntry[];
}

export function ChartTooltip({ active, label, entries }: ChartTooltipProps) {
  if (!active || !label) return null;

  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs text-text-tertiary mb-1">{formatDate(label)}</p>
      {entries.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-text-secondary">{entry.name}</span>
          <span className="text-xs font-financial text-text-primary ml-auto">
            {entry.value !== null ? formatCurrency(entry.value) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/ChartTooltip.tsx
git commit -m "feat(charts): add ChartTooltip shared component"
```

---

### Task 6: Create `TimeRangePicker` component

**Files:**
- Create: `src/components/charts/TimeRangePicker.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/charts/TimeRangePicker.tsx`:

```typescript
"use client";

import { TIME_RANGES } from "@/utils/constants";

interface TimeRangePickerProps {
  selected: string;
  onSelect: (period: string) => void;
}

export function TimeRangePicker({ selected, onSelect }: TimeRangePickerProps) {
  return (
    <div className="flex gap-1">
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onSelect(range.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selected === range.value
              ? "bg-green-primary text-white"
              : "bg-transparent border border-border-primary text-text-secondary hover:text-text-primary"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/TimeRangePicker.tsx
git commit -m "feat(charts): add TimeRangePicker component"
```

---

## Chunk 4: Main Chart Components

### Task 7: Create `PerformanceChart` component

**Files:**
- Create: `src/components/charts/PerformanceChart.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/charts/PerformanceChart.tsx`:

```typescript
"use client";

import {
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PortfolioChartPoint } from "@/types";
import { ChartTooltip } from "./ChartTooltip";
import { TimeRangePicker } from "./TimeRangePicker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/formatters";
import { format } from "date-fns";

interface PerformanceChartProps {
  data: PortfolioChartPoint[];
  benchmarkName: string;
  period: string;
  onPeriodChange: (period: string) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function CustomTooltip({
  active,
  label,
  payload,
  benchmarkName,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number; dataKey: string }>;
  benchmarkName: string;
}) {
  if (!active || !payload || !label) return null;

  const portfolioVal = payload.find((p) => p.dataKey === "portfolioValue")?.value ?? null;
  const benchmarkVal = payload.find((p) => p.dataKey === "benchmarkValue")?.value ?? null;
  const difference = portfolioVal !== null && benchmarkVal !== null
    ? portfolioVal - benchmarkVal
    : null;

  const entries = [
    {
      name: "Portfolio",
      value: portfolioVal,
      color: "var(--green-primary)",
    },
    {
      name: benchmarkName,
      value: benchmarkVal,
      color: "var(--oak-300)",
    },
    {
      name: "Difference",
      value: difference,
      color: difference !== null && difference >= 0 ? "var(--green-primary)" : "var(--red-primary)",
    },
  ];

  return <ChartTooltip active={active} label={label} entries={entries} />;
}

export function PerformanceChart({
  data,
  benchmarkName,
  period,
  onPeriodChange,
  loading,
  error,
  onRetry,
}: PerformanceChartProps) {
  const costBasis = data.length > 0 ? data[0].costBasis : 0;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base text-text-primary">
          Performance
        </h3>
        <TimeRangePicker selected={period} onSelect={onPeriodChange} />
      </div>

      {loading ? (
        <Skeleton className="h-[250px] md:h-[400px] w-full rounded-lg" />
      ) : error ? (
        <div className="h-[250px] md:h-[400px] flex flex-col items-center justify-center border border-border-primary rounded-lg">
          <p className="text-sm text-text-secondary mb-2">
            Unable to load chart data
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-green-primary hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="h-[250px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--green-primary)"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--green-primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-primary)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                  tickFormatter={(date: string) => format(new Date(date), "MMM d")}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                  tickFormatter={(v: number) => `$${formatCompactNumber(v)}`}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip
                  content={
                    <CustomTooltip benchmarkName={benchmarkName} />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="portfolioValue"
                  stroke="var(--green-primary)"
                  strokeWidth={2}
                  fill="url(#greenGradient)"
                  isAnimationActive={true}
                  animationDuration={800}
                />
                <Line
                  type="monotone"
                  dataKey="benchmarkValue"
                  stroke="var(--oak-300)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={800}
                  connectNulls={false}
                />
                {costBasis > 0 && (
                  <ReferenceLine
                    y={costBasis}
                    stroke="var(--text-tertiary)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-primary" />
              <span className="text-xs text-text-secondary">Portfolio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-oak-300" />
              <span className="text-xs text-text-secondary">
                {benchmarkName}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 border-t border-dashed border-text-tertiary" />
              <span className="text-xs text-text-secondary">Cost Basis</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/michaelpodolioukh/Oakstock && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/PerformanceChart.tsx
git commit -m "feat(charts): add PerformanceChart with benchmark overlay"
```

---

### Task 8: Create `CombinedChart` component

**Files:**
- Create: `src/components/charts/CombinedChart.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/charts/CombinedChart.tsx`:

```typescript
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { TimeRangePicker } from "./TimeRangePicker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/formatters";
import { format } from "date-fns";

interface CombinedChartProps {
  data: { date: string; value: number }[];
  period: string;
  onPeriodChange: (period: string) => void;
  loading: boolean;
}

function CombinedTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number }>;
}) {
  if (!active || !payload || !label) return null;

  return (
    <ChartTooltip
      active={active}
      label={label}
      entries={[
        {
          name: "Total Value",
          value: payload[0]?.value ?? null,
          color: "var(--green-primary)",
        },
      ]}
    />
  );
}

export function CombinedChart({
  data,
  period,
  onPeriodChange,
  loading,
}: CombinedChartProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base text-text-primary">
          Portfolio Performance
        </h3>
        <TimeRangePicker selected={period} onSelect={onPeriodChange} />
      </div>

      {loading ? (
        <Skeleton className="h-[250px] md:h-[350px] w-full rounded-lg" />
      ) : (
        <div className="h-[250px] md:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient
                  id="combinedGreenGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--green-primary)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--green-primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-primary)"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                tickFormatter={(date: string) => format(new Date(date), "MMM d")}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                tickFormatter={(v: number) => `$${formatCompactNumber(v)}`}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip content={<CombinedTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--green-primary)"
                strokeWidth={2}
                fill="url(#combinedGreenGradient)"
                isAnimationActive={true}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/CombinedChart.tsx
git commit -m "feat(charts): add CombinedChart for dashboard"
```

---

### Task 9: Create `AllocationDonut` component

**Files:**
- Create: `src/components/charts/AllocationDonut.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/charts/AllocationDonut.tsx`:

```typescript
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/utils/formatters";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface AllocationDonutProps {
  holdings: { ticker: string; marketValue: number }[];
  totalValue: number;
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { ticker: string; marketValue: number; percent: number };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs font-financial text-text-primary">{data.ticker}</p>
      <p className="text-xs text-text-secondary">
        {formatCurrency(data.marketValue)} ({formatPercent(data.percent)})
      </p>
    </div>
  );
}

function CustomLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  ticker,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  ticker: string;
  percent: number;
}) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-xs font-financial"
      fill="var(--text-secondary)"
    >
      {ticker} {percent.toFixed(0)}%
    </text>
  );
}

export function AllocationDonut({
  holdings,
  totalValue,
}: AllocationDonutProps) {
  if (holdings.length === 0 || totalValue === 0) return null;

  const chartData = holdings
    .filter((h) => h.marketValue > 0)
    .map((h) => ({
      ticker: h.ticker,
      marketValue: h.marketValue,
      percent: (h.marketValue / totalValue) * 100,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  return (
    <div>
      <h3 className="font-display text-base text-text-primary mb-4">
        Allocation
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="marketValue"
            nameKey="ticker"
            label={CustomLabel}
            isAnimationActive={true}
            animationDuration={800}
          >
            {chartData.map((_, index) => (
              <Cell
                key={index}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-lg font-financial"
            fill="var(--text-primary)"
          >
            {formatCurrency(totalValue)}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/AllocationDonut.tsx
git commit -m "feat(charts): add AllocationDonut pie chart"
```

---

### Task 10: Create `SectorBreakdown` component

**Files:**
- Create: `src/components/charts/SectorBreakdown.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/charts/SectorBreakdown.tsx`:

```typescript
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface SectorBreakdownProps {
  holdings: { sector: string | undefined; marketValue: number }[];
  totalValue: number;
}

export function SectorBreakdown({
  holdings,
  totalValue,
}: SectorBreakdownProps) {
  if (holdings.length === 0 || totalValue === 0) return null;

  // Group by sector
  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    const sector = h.sector ?? "Unknown";
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.marketValue);
  }

  const chartData = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      value,
      percent: (value / totalValue) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  const chartHeight = Math.max(chartData.length * 40, 120);

  return (
    <div>
      <h3 className="font-display text-base text-text-primary mb-4">
        Sectors
      </h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="sector"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={true}>
            {chartData.map((_, index) => (
              <Cell
                key={index}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
            <LabelList
              dataKey="percent"
              position="right"
              formatter={(v: number) => `${v.toFixed(1)}%`}
              style={{
                fill: "var(--text-secondary)",
                fontSize: 12,
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/SectorBreakdown.tsx
git commit -m "feat(charts): add SectorBreakdown bar chart"
```

---

### Task 11: Create `Sparkline` component

**Files:**
- Create: `src/components/charts/Sparkline.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/charts/Sparkline.tsx`:

```typescript
"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: number[];
  className?: string;
}

export function Sparkline({ data, className }: SparklineProps) {
  if (data.length < 2) return null;

  const isPositive = data[data.length - 1] >= data[0];
  const color = isPositive ? "var(--green-primary)" : "var(--red-primary)";
  const chartData = data.map((value) => ({ value }));

  return (
    <div className={className} style={{ width: 120, height: 40 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/Sparkline.tsx
git commit -m "feat(charts): add Sparkline mini chart"
```

---

## Chunk 5: Page Integration

### Task 12: Integrate charts into Portfolio Detail Page

**Files:**
- Modify: `src/app/portfolio/[id]/page.tsx`

- [ ] **Step 1: Update the page**

Replace the entire contents of `src/app/portfolio/[id]/page.tsx` with:

```typescript
"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useQuotes } from "@/hooks/useQuotes";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import {
  mergeHoldingWithQuote,
  portfolioTotals,
  totalShares,
  totalCost,
} from "@/utils/calculations";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { PerformanceSummaryBar } from "@/components/portfolio/PerformanceSummaryBar";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { AddHoldingModal } from "@/components/portfolio/AddHoldingModal";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { AllocationDonut } from "@/components/charts/AllocationDonut";
import { SectorBreakdown } from "@/components/charts/SectorBreakdown";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = params.id as string;
  const [period, setPeriod] = useState("1y");

  const portfolio = usePortfolioStore((s) =>
    s.portfolios.find((p) => p.id === portfolioId)
  );

  const tickers = useMemo(
    () => portfolio?.holdings.map((h) => h.ticker) ?? [],
    [portfolio?.holdings]
  );

  const { quotes, loading } = useQuotes(tickers);

  const holdingsWithQuotes = useMemo(
    () =>
      portfolio?.holdings.map((h) =>
        mergeHoldingWithQuote(h, quotes[h.ticker])
      ) ?? [],
    [portfolio?.holdings, quotes]
  );

  const summary = useMemo(() => {
    if (holdingsWithQuotes.length === 0) return null;
    return portfolioTotals(holdingsWithQuotes);
  }, [holdingsWithQuotes]);

  // Chart data inputs
  const historyInputs = useMemo(
    () =>
      portfolio?.holdings.map((h) => ({
        ticker: h.ticker,
        shares: totalShares(h.lots),
      })) ?? [],
    [portfolio?.holdings]
  );

  const costBasisTotal = useMemo(
    () =>
      portfolio?.holdings.reduce((sum, h) => sum + totalCost(h.lots), 0) ?? 0,
    [portfolio?.holdings]
  );

  const {
    data: chartData,
    loading: chartLoading,
    error: chartError,
    refetch: retryChart,
  } = usePortfolioHistory(
    historyInputs,
    portfolio?.benchmark ?? "SPY",
    period,
    costBasisTotal
  );

  // Allocation chart data
  const allocationData = useMemo(
    () =>
      holdingsWithQuotes
        .filter((h) => h.marketValue > 0)
        .map((h) => ({ ticker: h.ticker, marketValue: h.marketValue })),
    [holdingsWithQuotes]
  );

  // Sector chart data
  const sectorData = useMemo(
    () =>
      holdingsWithQuotes
        .filter((h) => h.marketValue > 0)
        .map((h) => ({ sector: h.sector, marketValue: h.marketValue })),
    [holdingsWithQuotes]
  );

  if (!portfolio) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center">
        <p className="text-text-secondary">Portfolio not found.</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => router.push("/")}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const existingTickers = portfolio.holdings.map((h) => h.ticker);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PortfolioHeader portfolio={portfolio} />
      <PerformanceSummaryBar data={summary} loading={loading} />

      <PerformanceChart
        data={chartData}
        benchmarkName={portfolio.benchmark ?? "SPY"}
        period={period}
        onPeriodChange={setPeriod}
        loading={chartLoading}
        error={chartError}
        onRetry={retryChart}
      />

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-text-primary">Holdings</h2>
        <AddHoldingModal
          portfolioId={portfolio.id}
          existingTickers={existingTickers}
        >
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Holding
          </Button>
        </AddHoldingModal>
      </div>

      <div className="md:grid md:grid-cols-[3fr_2fr] gap-6">
        <div>
          <HoldingsTable
            holdings={holdingsWithQuotes}
            portfolioId={portfolio.id}
          />
        </div>
        <div className="mt-6 md:mt-0 space-y-6">
          <AllocationDonut
            holdings={allocationData}
            totalValue={summary?.totalValue ?? 0}
          />
          <SectorBreakdown
            holdings={sectorData}
            totalValue={summary?.totalValue ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/michaelpodolioukh/Oakstock && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/portfolio/[id]/page.tsx
git commit -m "feat(portfolio): integrate charts into portfolio detail page"
```

---

### Task 13: Add sparkline data to `PortfolioCard`

**Files:**
- Modify: `src/components/dashboard/PortfolioCard.tsx`

- [ ] **Step 1: Update the component**

Replace the entire contents of `src/components/dashboard/PortfolioCard.tsx` with:

```typescript
"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { Portfolio, QuoteData } from "@/types";
import { totalShares, totalCost } from "@/utils/calculations";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { DeletePortfolioDialog } from "./DeletePortfolioDialog";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/charts/Sparkline";

export function PortfolioCard({
  portfolio,
  quotes,
  sparklineData,
}: {
  portfolio: Portfolio;
  quotes: Record<string, QuoteData>;
  sparklineData?: number[];
}) {
  let marketValue = 0;
  let costBasis = 0;

  for (const holding of portfolio.holdings) {
    const quote = quotes[holding.ticker];
    const shares = totalShares(holding.lots);
    const cost = totalCost(holding.lots);
    const price = quote?.currentPrice ?? 0;

    marketValue += shares * price;
    costBasis += cost;
  }

  const gainLoss = marketValue - costBasis;
  const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
  const hasData = portfolio.holdings.length > 0 && marketValue > 0;

  return (
    <div className="group relative rounded-xl border border-border-primary bg-bg-secondary p-5 transition-all duration-150 hover:border-oak-300/40 hover:scale-[1.005]">
      <Link
        href={`/portfolio/${portfolio.id}`}
        className="absolute inset-0 z-10"
      >
        <span className="sr-only">View {portfolio.name}</span>
      </Link>

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display text-base text-text-primary">
            {portfolio.name}
          </h3>
          {portfolio.description && (
            <p className="text-xs text-text-tertiary mt-0.5">
              {portfolio.description}
            </p>
          )}
        </div>
        <DeletePortfolioDialog
          portfolioId={portfolio.id}
          portfolioName={portfolio.name}
        >
          <Button
            variant="ghost"
            size="icon-xs"
            className="relative z-20 text-text-tertiary hover:text-red-primary opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </DeletePortfolioDialog>
      </div>

      {hasData ? (
        <>
          <p className="text-xl font-financial text-text-primary mb-1">
            {formatCurrency(marketValue)}
          </p>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-financial ${gainLoss >= 0 ? "text-green-primary" : "text-red-primary"}`}
            >
              {formatCurrency(gainLoss)} ({formatPercent(gainLossPercent)})
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-text-tertiary">
              {portfolio.holdings.length} holding
              {portfolio.holdings.length !== 1 ? "s" : ""}
            </p>
            {sparklineData && <Sparkline data={sparklineData} />}
          </div>
        </>
      ) : (
        <p className="text-sm text-text-tertiary">
          {portfolio.holdings.length === 0
            ? "No holdings yet"
            : "Loading prices..."}
        </p>
      )}
    </div>
  );
}
```

**Key change:** Added `sparklineData?: number[]` prop and renders `<Sparkline>` at the bottom of the card when data is available. The holdings count and sparkline sit side-by-side.

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/PortfolioCard.tsx
git commit -m "feat(portfolio-card): add sparkline rendering"
```

---

### Task 14: Update `PortfolioGrid` to pass sparkline data

**Files:**
- Modify: `src/components/dashboard/PortfolioGrid.tsx`

- [ ] **Step 1: Update the component**

Replace the entire contents of `src/components/dashboard/PortfolioGrid.tsx` with:

```typescript
"use client";

import type { Portfolio, QuoteData } from "@/types";
import { PortfolioCard } from "./PortfolioCard";

export function PortfolioGrid({
  portfolios,
  quotes,
  sparklineMap,
}: {
  portfolios: Portfolio[];
  quotes: Record<string, QuoteData>;
  sparklineMap?: Record<string, number[]>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {portfolios.map((portfolio) => (
        <PortfolioCard
          key={portfolio.id}
          portfolio={portfolio}
          quotes={quotes}
          sparklineData={sparklineMap?.[portfolio.id]}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/PortfolioGrid.tsx
git commit -m "feat(portfolio-grid): pass sparkline data to cards"
```

---

### Task 15: Integrate charts into Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update the page**

Replace the entire contents of `src/app/page.tsx` with:

```typescript
"use client";

import { useMemo, useState, useEffect } from "react";
import { TreeDeciduous, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useQuotes } from "@/hooks/useQuotes";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import {
  mergeHoldingWithQuote,
  portfolioTotals,
  totalShares,
  totalCost,
} from "@/utils/calculations";
import { CreatePortfolioDialog } from "@/components/dashboard/CreatePortfolioDialog";
import { PortfolioSummaryCards } from "@/components/dashboard/PortfolioSummaryCards";
import { PortfolioGrid } from "@/components/dashboard/PortfolioGrid";
import { CombinedChart } from "@/components/charts/CombinedChart";
import { fetchHistory } from "@/services/yahooFinance";

export default function DashboardPage() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const [period, setPeriod] = useState("1y");
  const [sparklineMap, setSparklineMap] = useState<Record<string, number[]>>(
    {}
  );

  // Collect all unique tickers across all portfolios
  const allTickers = useMemo(() => {
    const set = new Set<string>();
    for (const p of portfolios) {
      for (const h of p.holdings) {
        set.add(h.ticker);
      }
    }
    return Array.from(set);
  }, [portfolios]);

  const { quotes, loading } = useQuotes(allTickers);

  // Compute summary across all portfolios
  const summary = useMemo(() => {
    if (allTickers.length === 0) return null;
    const allHoldings = portfolios.flatMap((p) =>
      p.holdings.map((h) => mergeHoldingWithQuote(h, quotes[h.ticker]))
    );
    return portfolioTotals(allHoldings);
  }, [portfolios, quotes, allTickers.length]);

  // Combined chart data: all holdings from all portfolios
  const combinedHistoryInputs = useMemo(
    () =>
      portfolios.flatMap((p) =>
        p.holdings.map((h) => ({
          ticker: h.ticker,
          shares: totalShares(h.lots),
        }))
      ),
    [portfolios]
  );

  const combinedCostBasis = useMemo(
    () =>
      portfolios.reduce(
        (sum, p) =>
          sum + p.holdings.reduce((s, h) => s + totalCost(h.lots), 0),
        0
      ),
    [portfolios]
  );

  const { data: combinedChartData, loading: chartLoading } =
    usePortfolioHistory(
      combinedHistoryInputs,
      "SPY", // Default benchmark for dashboard combined chart
      period,
      combinedCostBasis
    );

  const combinedChartSimple = useMemo(
    () =>
      combinedChartData.map((p) => ({
        date: p.date,
        value: p.portfolioValue,
      })),
    [combinedChartData]
  );

  // Sparkline data: fetch 1m history for all tickers, aggregate per portfolio
  useEffect(() => {
    if (allTickers.length === 0 || portfolios.length === 0) {
      setSparklineMap({});
      return;
    }

    let cancelled = false;

    async function loadSparklines() {
      const results = await Promise.allSettled(
        allTickers.map((t) => fetchHistory(t, "1m"))
      );

      if (cancelled) return;

      // Build ticker -> { date -> close } map
      const historyMap: Record<string, Record<string, number>> = {};
      for (let i = 0; i < allTickers.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          const map: Record<string, number> = {};
          for (const point of result.value) {
            map[point.date] = point.close;
          }
          historyMap[allTickers[i]] = map;
        }
      }

      // Collect all dates
      const dateSet = new Set<string>();
      for (const tickerMap of Object.values(historyMap)) {
        for (const date of Object.keys(tickerMap)) {
          dateSet.add(date);
        }
      }
      const sortedDates = Array.from(dateSet).sort();

      // Compute sparkline per portfolio
      const map: Record<string, number[]> = {};
      for (const p of portfolios) {
        const values: number[] = [];
        for (const date of sortedDates) {
          let value = 0;
          for (const h of p.holdings) {
            const close = historyMap[h.ticker]?.[date];
            if (close !== undefined) {
              value += totalShares(h.lots) * close;
            }
          }
          if (value > 0) {
            values.push(value);
          }
        }
        if (values.length >= 2) {
          map[p.id] = values;
        }
      }

      if (!cancelled) {
        setSparklineMap(map);
      }
    }

    loadSparklines();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTickers.join(","), portfolios.length]);

  if (portfolios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-104px)] px-6 text-center">
        <TreeDeciduous className="h-16 w-16 text-oak-300 mb-4 opacity-60" />
        <h1 className="font-display text-2xl text-text-primary mb-2">
          Plant your first portfolio
        </h1>
        <p className="text-text-secondary text-sm mb-6 max-w-sm">
          Start tracking your investments with Oakstock. Create a portfolio to
          get started.
        </p>
        <CreatePortfolioDialog>
          <Button size="lg" className="font-semibold">
            Create Portfolio
          </Button>
        </CreatePortfolioDialog>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-text-primary">Dashboard</h1>
        <CreatePortfolioDialog>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Portfolio
          </Button>
        </CreatePortfolioDialog>
      </div>

      <PortfolioSummaryCards data={summary} loading={loading} />

      <CombinedChart
        data={combinedChartSimple}
        period={period}
        onPeriodChange={setPeriod}
        loading={chartLoading}
      />

      <PortfolioGrid
        portfolios={portfolios}
        quotes={quotes}
        sparklineMap={sparklineMap}
      />
    </div>
  );
}
```

**Key changes:**
- Added `CombinedChart` between summary cards and portfolio grid
- Added sparkline data fetching via `useEffect` (fetches 1m history once, aggregates per portfolio)
- Passes `sparklineMap` to `PortfolioGrid`

- [ ] **Step 2: Verify the build**

Run: `cd /Users/michaelpodolioukh/Oakstock && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Visual smoke test**

Open `http://localhost:3000` in a browser. Verify:
1. Dashboard shows the combined performance chart with time range picker
2. Portfolio cards show sparklines (may take a moment to load)
3. Click into a portfolio — verify performance chart, allocation donut, and sector breakdown render
4. Time range picker changes the chart period
5. Empty state (no portfolios) still renders correctly

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): integrate combined chart and sparklines"
```

---

## Summary

| Chunk | Tasks | New Files | Modified Files |
|-------|-------|-----------|----------------|
| 1: API & Types | 1-3 | 0 | 3 (`types/index.ts`, `api/quote`, `api/quotes`) |
| 2: Data Hook | 4 | 1 (`usePortfolioHistory.ts`) | 0 |
| 3: Shared Components | 5-6 | 2 (`ChartTooltip`, `TimeRangePicker`) | 0 |
| 4: Chart Components | 7-11 | 5 (`PerformanceChart`, `CombinedChart`, `AllocationDonut`, `SectorBreakdown`, `Sparkline`) | 0 |
| 5: Page Integration | 12-15 | 0 | 4 (`portfolio/[id]/page`, `PortfolioCard`, `PortfolioGrid`, `page.tsx`) |

**Total: 15 tasks, 8 new files, 7 modified files**
