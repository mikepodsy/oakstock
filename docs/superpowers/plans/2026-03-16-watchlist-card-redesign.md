# Watchlist Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign watchlist cards with company logos, multi-timeframe performance pills, and inline accordion expansion showing price chart, financials, company info, and analyst consensus.

**Architecture:** Backend-first approach — types and API endpoints first, then hooks/services, then UI components. Each layer builds on the previous. The existing watchlist page orchestrates state; cards become richer but the data flow stays the same (API → service → hook → component).

**Tech Stack:** Next.js 14 (App Router), React, Recharts, Tailwind CSS, yahoo-finance2, Logo.dev API, Zustand

**Spec:** `docs/superpowers/specs/2026-03-16-watchlist-card-redesign-design.md`

---

## File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `src/types/index.ts` | Add `FinancialData`, `PerformanceReturns` types; add `website?` to `QuoteData` | Modify |
| `src/app/api/history/route.ts` | Add `ytd` and `3y` period support | Modify |
| `src/app/api/quote/route.ts` | Add `website` field to response | Modify |
| `src/app/api/financials/route.ts` | New endpoint for comprehensive financial data | Create |
| `src/services/yahooFinance.ts` | Add `fetchFinancials()` function | Modify |
| `src/hooks/usePerformanceReturns.ts` | Hook to compute multi-period returns | Create |
| `src/hooks/useFinancials.ts` | Hook to fetch financial data on expand | Create |
| `src/components/charts/StockPriceChart.tsx` | Simple single-stock area chart | Create |
| `src/components/watchlist/WatchlistCard.tsx` | Complete redesign with logo, pills, accordion | Modify |
| `src/components/watchlist/WatchlistCardDetail.tsx` | Expanded detail view (chart, financials, about, analysts) | Create |
| `src/components/watchlist/WatchlistGrid.tsx` | Pass through expandedItemId and onToggle | Modify |
| `src/app/watchlist/page.tsx` | Add expandedItemId state, remove sparkline fetching | Modify |

---

## Chunk 1: Types, API Endpoints, and Service Layer

### Task 1: Add New Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add FinancialData and PerformanceReturns types, extend QuoteData**

Add after the `QuoteData` interface (line 78):

```typescript
export interface FinancialData {
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

export type PerformancePeriod = '1M' | '3M' | 'YTD' | '1Y' | '3Y' | '5Y';
export type PerformanceReturns = Record<PerformancePeriod, number | null>;
```

Add `website?` to existing `QuoteData` interface (after `sector?: string;` on line 76):

```typescript
  website?: string;
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add FinancialData, PerformanceReturns types and website to QuoteData"
```

---

### Task 2: Add `ytd` and `3y` Periods to History API

**Files:**
- Modify: `src/app/api/history/route.ts`

- [ ] **Step 1: Add new period cases to getPeriodStartDate**

In `getPeriodStartDate` function, add two new cases before the `default:` case (after the `case "5y":` block at line 25):

```typescript
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "3y":
      return subYears(now, 3);
```

- [ ] **Step 2: Update interval selection to include new periods**

Change the interval logic on line 49 from:

```typescript
      interval: ["1d", "5d", "1w", "1m"].includes(period) ? "1d" : "1wk",
```

to:

```typescript
      interval: ["1d", "5d", "1w", "1m"].includes(period) ? "1d" : "1wk",
```

No change needed — `ytd` and `3y` both fall through to `"1wk"` which is correct.

- [ ] **Step 3: Manually test the new periods**

Run: `curl "http://localhost:3000/api/history?ticker=AAPL&period=ytd" | head -c 200`
Expected: JSON array of `{date, close}` objects starting from January 2026.

Run: `curl "http://localhost:3000/api/history?ticker=AAPL&period=3y" | head -c 200`
Expected: JSON array starting from ~March 2023.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/history/route.ts
git commit -m "feat(api): add ytd and 3y period support to history endpoint"
```

---

### Task 3: Add `website` Field to Quote API

**Files:**
- Modify: `src/app/api/quote/route.ts`

- [ ] **Step 1: Extract website from existing assetProfile response**

The `/api/quote` route already fetches `assetProfile` in its `quoteSummary` call (line 19-21). Add the `website` field to the response object. In the first `try` block (the quoteSummary path), after `sector: profile?.sector ?? undefined,` (line 39), add:

```typescript
        website: profile?.website ?? undefined,
```

The fallback path (the `catch` block using `quote()`) doesn't have profile data, so add:

```typescript
        website: undefined,
```

after `sector: undefined,` on line 57.

- [ ] **Step 2: Manually test**

Run: `curl "http://localhost:3000/api/quote?ticker=NVDA" | python3 -m json.tool | grep website`
Expected: `"website": "https://www.nvidia.com"` (or similar)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/quote/route.ts
git commit -m "feat(api): add website field to quote endpoint response"
```

---

### Task 4: Create Financials API Endpoint

**Files:**
- Create: `src/app/api/financials/route.ts`

- [ ] **Step 1: Create the financials route**

Create `src/app/api/financials/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

const RATING_MAP: Record<string, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  underperform: "Underperform",
  sell: "Sell",
  strong_sell: "Strong Sell",
};

function extractDomain(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function formatRating(key: string | undefined | null): string | null {
  if (!key) return null;
  return RATING_MAP[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ["defaultKeyStatistics", "financialData", "assetProfile"],
    });

    const stats = summary.defaultKeyStatistics;
    const fin = summary.financialData;
    const profile = summary.assetProfile;

    return NextResponse.json({
      ticker,
      peRatio: stats?.trailingPE ?? null,
      eps: stats?.trailingEps ?? null,
      revenue: fin?.totalRevenue ?? null,
      profitMargin: fin?.profitMargins ?? null,
      debtToEquity: fin?.debtToEquity ?? null,
      dividendYield: stats?.dividendYield ?? null,
      volume: fin?.volume ?? null,
      fiftyTwoWeekHigh: stats?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: stats?.fiftyTwoWeekLow ?? null,
      description: profile?.longBusinessSummary ?? null,
      analystRating: formatRating(fin?.recommendationKey),
      targetPrice: fin?.targetMeanPrice ?? null,
      website: extractDomain(profile?.website),
    });
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch financials for ${ticker}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Manually test**

Run: `curl "http://localhost:3000/api/financials?ticker=NVDA" | python3 -m json.tool`
Expected: JSON with all FinancialData fields populated (eps, revenue, profitMargin, etc.)

Run: `curl "http://localhost:3000/api/financials?ticker=INVALID" -w "%{http_code}"`
Expected: 500 status code with error message

- [ ] **Step 3: Commit**

```bash
git add src/app/api/financials/route.ts
git commit -m "feat(api): add financials endpoint for comprehensive stock data"
```

---

### Task 5: Add `fetchFinancials` to Service Layer

**Files:**
- Modify: `src/services/yahooFinance.ts`

- [ ] **Step 1: Add fetchFinancials function**

Add import at top of file:

```typescript
import type { QuoteData, HistoricalDataPoint, FinancialData } from "@/types";
```

Add function at the end of the file:

```typescript
export async function fetchFinancials(ticker: string): Promise<FinancialData> {
  const res = await fetch(`/api/financials?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error(`Failed to fetch financials for ${ticker}`);
  return res.json();
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/yahooFinance.ts
git commit -m "feat(services): add fetchFinancials to yahoo finance service"
```

---

### Task 6: Create `usePerformanceReturns` Hook

**Files:**
- Create: `src/hooks/usePerformanceReturns.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/usePerformanceReturns.ts`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { fetchHistory } from "@/services/yahooFinance";
import type { PerformanceReturns, PerformancePeriod } from "@/types";

const PERIOD_API_MAP: Record<PerformancePeriod, string> = {
  "1M": "1m",
  "3M": "3m",
  "YTD": "ytd",
  "1Y": "1y",
  "3Y": "3y",
  "5Y": "5y",
};

const PERIODS = Object.keys(PERIOD_API_MAP) as PerformancePeriod[];

export function usePerformanceReturns(
  ticker: string,
  currentPrice: number
): { returns: PerformanceReturns | null; loading: boolean } {
  const [returns, setReturns] = useState<PerformanceReturns | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker || !currentPrice || currentPrice <= 0) {
      setReturns(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function compute() {
      const results = await Promise.all(
        PERIODS.map(async (period): Promise<[PerformancePeriod, number | null]> => {
          try {
            const data = await fetchHistory(ticker, PERIOD_API_MAP[period]);
            if (!data || data.length === 0) return [period, null];
            const firstClose = data[0].close;
            if (!firstClose || firstClose <= 0) return [period, null];
            return [period, ((currentPrice - firstClose) / firstClose) * 100];
          } catch {
            return [period, null];
          }
        })
      );

      if (cancelled) return;

      const map = Object.fromEntries(results) as PerformanceReturns;
      setReturns(map);
      setLoading(false);
    }

    compute();
    return () => { cancelled = true; };
  }, [ticker, currentPrice]);

  return { returns, loading };
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePerformanceReturns.ts
git commit -m "feat(hooks): add usePerformanceReturns hook for multi-period return calculation"
```

---

### Task 7: Create `useFinancials` Hook

**Files:**
- Create: `src/hooks/useFinancials.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useFinancials.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchFinancials } from "@/services/yahooFinance";
import type { FinancialData } from "@/types";

export function useFinancials(ticker: string | null): {
  data: FinancialData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticker) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFinancials(ticker);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch financials");
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFinancials.ts
git commit -m "feat(hooks): add useFinancials hook for expanded card data"
```

---

## Chunk 2: UI Components

### Task 8: Create `StockPriceChart` Component

**Files:**
- Create: `src/components/charts/StockPriceChart.tsx`

- [ ] **Step 1: Create the chart component**

Create `src/components/charts/StockPriceChart.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
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
import { fetchHistory } from "@/services/yahooFinance";
import { format } from "date-fns";
import type { HistoricalDataPoint } from "@/types";

interface StockPriceChartProps {
  ticker: string;
}

function StockTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number; dataKey: string }>;
}) {
  if (!active || !payload || !label) return null;
  const price = payload.find((p) => p.dataKey === "close")?.value ?? null;
  return (
    <ChartTooltip
      active={active}
      label={label}
      entries={[{ name: "Price", value: price, color: "var(--green-primary)" }]}
    />
  );
}

export function StockPriceChart({ ticker }: StockPriceChartProps) {
  const [period, setPeriod] = useState("3m");
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchHistory(ticker, period)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load chart");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [ticker, period]);

  const isUp =
    data.length >= 2 ? data[data.length - 1].close >= data[0].close : true;
  const areaColor = isUp ? "var(--green-primary)" : "var(--red-primary)";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text-primary">
          Price Chart
        </span>
        <TimeRangePicker selected={period} onSelect={setPeriod} />
      </div>

      {loading ? (
        <Skeleton className="h-[200px] w-full rounded-lg" />
      ) : error ? (
        <div className="h-[200px] flex items-center justify-center border border-border-primary rounded-lg">
          <p className="text-sm text-text-secondary">Unable to load chart</p>
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={areaColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={areaColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(v: number) => `$${formatCompactNumber(v)}`}
                tickLine={false}
                axisLine={false}
                width={60}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<StockTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={areaColor}
                strokeWidth={2}
                fill={`url(#grad-${ticker})`}
                isAnimationActive={true}
                animationDuration={600}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/StockPriceChart.tsx
git commit -m "feat(charts): add StockPriceChart component for single-stock price display"
```

---

### Task 9: Create `WatchlistCardDetail` Component

**Files:**
- Create: `src/components/watchlist/WatchlistCardDetail.tsx`

- [ ] **Step 1: Create the expanded detail component**

Create `src/components/watchlist/WatchlistCardDetail.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useFinancials } from "@/hooks/useFinancials";
import { StockPriceChart } from "@/components/charts/StockPriceChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatCompactNumber,
  formatPercent,
} from "@/utils/formatters";

interface WatchlistCardDetailProps {
  ticker: string;
  currentPrice: number;
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-lg bg-bg-tertiary p-3">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-sm font-financial text-text-primary">
        {value ?? <span className="text-text-tertiary">N/A</span>}
      </p>
    </div>
  );
}

function getRatingColor(rating: string): string {
  const lower = rating.toLowerCase();
  if (lower.includes("buy")) return "bg-green-muted text-green-primary";
  if (lower.includes("hold")) return "bg-yellow-500/10 text-yellow-500";
  return "bg-red-muted text-red-primary";
}

export function WatchlistCardDetail({
  ticker,
  currentPrice,
}: WatchlistCardDetailProps) {
  const { data, loading, error, refetch } = useFinancials(ticker);
  const [showFullDesc, setShowFullDesc] = useState(false);

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-border-primary space-y-4">
        <Skeleton className="h-[200px] w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 pt-4 border-t border-border-primary">
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-text-secondary mb-2">
            Failed to load details
          </p>
          <button
            onClick={refetch}
            className="text-sm text-green-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const description = data?.description ?? null;
  const truncatedDesc =
    description && description.length > 300 && !showFullDesc
      ? description.slice(0, 300).replace(/\s+\S*$/, "") + "..."
      : description;

  return (
    <div className="mt-4 pt-4 border-t border-border-primary space-y-5">
      {/* Price Chart */}
      <StockPriceChart ticker={ticker} />

      {/* Key Financials */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">
          Key Financials
        </p>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="P/E Ratio"
            value={data?.peRatio != null ? data.peRatio.toFixed(2) : null}
          />
          <MetricCard
            label="EPS (TTM)"
            value={data?.eps != null ? formatCurrency(data.eps) : null}
          />
          <MetricCard
            label="Revenue (TTM)"
            value={
              data?.revenue != null
                ? `$${formatCompactNumber(data.revenue)}`
                : null
            }
          />
          <MetricCard
            label="Profit Margin"
            value={
              data?.profitMargin != null
                ? `${(data.profitMargin * 100).toFixed(1)}%`
                : null
            }
          />
          <MetricCard
            label="52W High"
            value={
              data?.fiftyTwoWeekHigh != null
                ? formatCurrency(data.fiftyTwoWeekHigh)
                : null
            }
          />
          <MetricCard
            label="52W Low"
            value={
              data?.fiftyTwoWeekLow != null
                ? formatCurrency(data.fiftyTwoWeekLow)
                : null
            }
          />
          <MetricCard
            label="Debt/Equity"
            value={
              data?.debtToEquity != null ? data.debtToEquity.toFixed(2) : null
            }
          />
          <MetricCard
            label="Dividend Yield"
            value={
              data?.dividendYield != null
                ? `${(data.dividendYield * 100).toFixed(2)}%`
                : null
            }
          />
        </div>
      </div>

      {/* About */}
      {truncatedDesc && (
        <div className="rounded-lg bg-bg-tertiary p-3">
          <p className="text-xs text-text-tertiary mb-1">About</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            {truncatedDesc}
          </p>
          {description && description.length > 300 && (
            <button
              onClick={() => setShowFullDesc(!showFullDesc)}
              className="text-xs text-green-primary hover:underline mt-1"
            >
              {showFullDesc ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Analyst Consensus */}
      {data?.analystRating && (
        <div className="rounded-lg bg-bg-tertiary p-3">
          <p className="text-xs text-text-tertiary mb-2">Analyst Consensus</p>
          <div className="flex items-center gap-3">
            <Badge className={getRatingColor(data.analystRating)}>
              {data.analystRating}
            </Badge>
            {data.targetPrice != null && (
              <span className="text-xs text-text-secondary">
                Target: {formatCurrency(data.targetPrice)}
                {currentPrice > 0 && (
                  <span
                    className={
                      data.targetPrice >= currentPrice
                        ? "text-green-primary"
                        : "text-red-primary"
                    }
                  >
                    {" "}
                    ({formatPercent(
                      ((data.targetPrice - currentPrice) / currentPrice) * 100
                    )})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/watchlist/WatchlistCardDetail.tsx
git commit -m "feat(watchlist): add WatchlistCardDetail component for expanded view"
```

---

### Task 10: Redesign `WatchlistCard` Component

**Files:**
- Modify: `src/components/watchlist/WatchlistCard.tsx`

- [ ] **Step 1: Replace the entire WatchlistCard with the redesigned version**

Replace the full contents of `src/components/watchlist/WatchlistCard.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchlistCardDetail } from "./WatchlistCardDetail";
import { EditWatchlistDialog } from "./EditWatchlistDialog";
import { usePerformanceReturns } from "@/hooks/usePerformanceReturns";
import { formatCurrency, formatPercent, formatCompactNumber } from "@/utils/formatters";
import type { WatchlistItem, QuoteData, PerformancePeriod } from "@/types";

interface WatchlistCardProps {
  watchlistId: string;
  item: WatchlistItem;
  quote?: QuoteData;
  isExpanded: boolean;
  onToggle: () => void;
}

const LOGO_COLORS = [
  "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

function getLogoColor(ticker: string): string {
  const hash = ticker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return LOGO_COLORS[hash % LOGO_COLORS.length];
}

function CompanyLogo({
  ticker,
  website,
}: {
  ticker: string;
  website?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  const domain = website
    ? website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    : null;
  const logoUrl =
    token && domain ? `https://img.logo.dev/${domain}?token=${token}&size=128` : null;

  if (!logoUrl || imgError) {
    return (
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
        style={{ backgroundColor: getLogoColor(ticker) }}
      >
        {ticker.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${ticker} logo`}
      className="w-14 h-14 rounded-xl object-contain bg-white shrink-0"
      onError={() => setImgError(true)}
    />
  );
}

const PERF_PERIODS: PerformancePeriod[] = ["1M", "3M", "YTD", "1Y", "3Y", "5Y"];

function PerformancePills({
  ticker,
  currentPrice,
}: {
  ticker: string;
  currentPrice: number;
}) {
  const { returns, loading } = usePerformanceReturns(ticker, currentPrice);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {PERF_PERIODS.map((p) => (
          <Skeleton key={p} className="h-7 w-24 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {PERF_PERIODS.map((period) => {
        const value = returns?.[period] ?? null;
        if (value === null) {
          return (
            <span
              key={period}
              className="px-3 py-1 rounded-full text-xs font-medium bg-bg-tertiary text-text-tertiary"
            >
              {period}: —
            </span>
          );
        }
        const isPositive = value >= 0;
        return (
          <span
            key={period}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isPositive
                ? "bg-green-muted text-green-primary"
                : "bg-red-muted text-red-primary"
            }`}
          >
            {period}: {value >= 0 ? "+" : ""}
            {value.toFixed(2)}%
          </span>
        );
      })}
    </div>
  );
}

export function WatchlistCard({
  watchlistId,
  item,
  quote,
  isExpanded,
  onToggle,
}: WatchlistCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div
        className={`rounded-xl border bg-bg-secondary transition-all duration-300 ${
          isExpanded
            ? "border-green-primary/40 shadow-lg"
            : "border-border-primary hover:border-oak-300/40"
        }`}
      >
        {/* Clickable card header */}
        <div
          className="p-5 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggle();
            }
          }}
        >
          {/* Top row: Logo + Info + Price */}
          <div className="flex items-center gap-4 mb-4">
            <CompanyLogo ticker={item.ticker} website={quote?.website} />
            <div className="flex-1 min-w-0">
              <h3 className="font-financial text-lg text-text-primary">
                {item.ticker}
              </h3>
              <p className="text-xs text-text-tertiary truncate">{item.name}</p>
              {quote?.marketCap != null && (
                <p className="text-xs text-text-tertiary">
                  Market Cap: ${formatCompactNumber(quote.marketCap)}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              {quote ? (
                <>
                  <p className="text-xl font-financial text-text-primary">
                    {formatCurrency(quote.currentPrice)}
                  </p>
                  <Badge
                    className={
                      quote.dayChangePercent >= 0
                        ? "bg-green-muted text-green-primary"
                        : "bg-red-muted text-red-primary"
                    }
                  >
                    {formatPercent(quote.dayChangePercent)}
                  </Badge>
                </>
              ) : (
                <>
                  <Skeleton className="h-7 w-24 mb-1 ml-auto" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                </>
              )}
            </div>
          </div>

          {/* Performance Pills */}
          {quote && (
            <div className="text-center">
              <p className="text-xs font-medium text-text-secondary mb-2">
                Performance
              </p>
              <PerformancePills
                ticker={item.ticker}
                currentPrice={quote.currentPrice}
              />
            </div>
          )}
        </div>

        {/* Expanded Detail (Accordion) */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          }`}
          style={{
            ...(typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? { transition: "none" }
              : {}),
          }}
        >
          {isExpanded && quote && (
            <div className="px-5 pb-5">
              <WatchlistCardDetail
                ticker={item.ticker}
                currentPrice={quote.currentPrice}
              />

              {/* Edit button */}
              <div className="mt-4 pt-3 border-t border-border-primary">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialogOpen(true);
                  }}
                  className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                >
                  Edit target price & notes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <EditWatchlistDialog
        watchlistId={watchlistId}
        item={item}
        quote={quote}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/watchlist/WatchlistCard.tsx
git commit -m "feat(watchlist): redesign WatchlistCard with logo, performance pills, and accordion"
```

---

### Task 11: Update `WatchlistGrid` to Pass Expansion Props

**Files:**
- Modify: `src/components/watchlist/WatchlistGrid.tsx`

- [ ] **Step 1: Replace WatchlistGrid contents**

Replace the full contents of `src/components/watchlist/WatchlistGrid.tsx`:

```typescript
"use client";

import { WatchlistCard } from "./WatchlistCard";
import type { WatchlistItem, QuoteData } from "@/types";

interface WatchlistGridProps {
  watchlistId: string;
  items: WatchlistItem[];
  quotes: Record<string, QuoteData>;
  expandedItemId: string | null;
  onToggleExpand: (itemId: string) => void;
}

export function WatchlistGrid({
  watchlistId,
  items,
  quotes,
  expandedItemId,
  onToggleExpand,
}: WatchlistGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => (
        <WatchlistCard
          key={item.id}
          watchlistId={watchlistId}
          item={item}
          quote={quotes[item.ticker]}
          isExpanded={expandedItemId === item.id}
          onToggle={() => onToggleExpand(item.id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/watchlist/WatchlistGrid.tsx
git commit -m "feat(watchlist): update WatchlistGrid to support accordion expansion"
```

---

### Task 12: Update Watchlist Page

**Files:**
- Modify: `src/app/watchlist/page.tsx`

- [ ] **Step 1: Replace the watchlist page**

Replace the full contents of `src/app/watchlist/page.tsx`:

```typescript
"use client";

import { useMemo, useState, useEffect } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { useQuotes } from "@/hooks/useQuotes";
import { TickerSearch } from "@/components/search/TickerSearch";
import { WatchlistGrid } from "@/components/watchlist/WatchlistGrid";
import { CreateWatchlistDialog } from "@/components/watchlist/CreateWatchlistDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function WatchlistPage() {
  const watchlists = useWatchlistStore((s) => s.watchlists);
  const addItem = useWatchlistStore((s) => s.addItem);
  const deleteWatchlist = useWatchlistStore((s) => s.deleteWatchlist);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Auto-select first watchlist if none selected or selected was deleted
  useEffect(() => {
    if (watchlists.length === 0) {
      setSelectedId(null);
    } else if (!selectedId || !watchlists.find((w) => w.id === selectedId)) {
      setSelectedId(watchlists[0].id);
    }
  }, [watchlists, selectedId]);

  // Collapse expanded card when switching watchlists
  useEffect(() => {
    setExpandedItemId(null);
  }, [selectedId]);

  const selectedWatchlist = watchlists.find((w) => w.id === selectedId);
  const items = selectedWatchlist?.items ?? [];

  const tickers = useMemo(() => items.map((i) => i.ticker), [items]);
  const { quotes } = useQuotes(tickers);

  function handleAddTicker(result: { ticker: string; name: string }) {
    if (!selectedId) return;

    if (items.find((i) => i.ticker === result.ticker)) {
      toast.error(`${result.ticker} is already in this watchlist`);
      return;
    }

    addItem(selectedId, { ticker: result.ticker, name: result.name });
    toast.success(`Added ${result.ticker} to watchlist`);
  }

  function handleDeleteWatchlist() {
    if (!selectedWatchlist) return;
    deleteWatchlist(selectedWatchlist.id);
    toast.success(`Deleted "${selectedWatchlist.name}"`);
  }

  function handleToggleExpand(itemId: string) {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  }

  // No watchlists created yet
  if (watchlists.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-text-primary">Watchlist</h1>
          <CreateWatchlistDialog onCreated={(id) => setSelectedId(id)}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Watchlist
            </Button>
          </CreateWatchlistDialog>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-280px)] px-6 text-center">
          <Eye className="h-16 w-16 text-oak-300 mb-4 opacity-60" />
          <h2 className="font-display text-2xl text-text-primary mb-2">
            No watchlists yet
          </h2>
          <p className="text-text-secondary text-sm mb-6 max-w-sm">
            Create a watchlist to start tracking stocks you&apos;re interested
            in.
          </p>
          <CreateWatchlistDialog onCreated={(id) => setSelectedId(id)}>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Create Watchlist
            </Button>
          </CreateWatchlistDialog>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-text-primary">Watchlist</h1>
        <CreateWatchlistDialog onCreated={(id) => setSelectedId(id)}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Watchlist
          </Button>
        </CreateWatchlistDialog>
      </div>

      {/* Watchlist Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {watchlists.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedId(w.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              w.id === selectedId
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            {w.name}
            <span className="ml-1.5 text-xs opacity-70">
              {w.items.length}
            </span>
          </button>
        ))}

        {selectedWatchlist && (
          <button
            onClick={handleDeleteWatchlist}
            className="ml-auto p-1.5 rounded-lg text-text-tertiary hover:text-red-primary hover:bg-red-muted transition-colors"
            title={`Delete "${selectedWatchlist.name}"`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <TickerSearch onSelect={handleAddTicker} />
      </div>

      {/* Grid or Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] px-6 text-center">
          <Eye className="h-12 w-12 text-oak-300 mb-4 opacity-60" />
          <h2 className="font-display text-lg text-text-primary mb-2">
            No stocks in &ldquo;{selectedWatchlist?.name}&rdquo;
          </h2>
          <p className="text-text-secondary text-sm max-w-sm">
            Search above to add stocks to this watchlist.
          </p>
        </div>
      ) : (
        <WatchlistGrid
          watchlistId={selectedId!}
          items={items}
          quotes={quotes}
          expandedItemId={expandedItemId}
          onToggleExpand={handleToggleExpand}
        />
      )}
    </div>
  );
}
```

Key changes from original:
- Removed `sparklineMap` state and sparkline fetching `useEffect` (performance pills replace sparklines)
- Removed `fetchHistory` import
- Added `expandedItemId` state
- Added `handleToggleExpand` function
- Collapse expanded card on watchlist switch
- Pass `expandedItemId` and `onToggleExpand` to `WatchlistGrid`

- [ ] **Step 2: Verify the app builds**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/watchlist/page.tsx
git commit -m "feat(watchlist): update page with accordion state and remove sparkline fetching"
```

---

### Task 13: Add `NEXT_PUBLIC_LOGO_DEV_TOKEN` to Environment

**Files:**
- Create: `.env.local` (if doesn't exist)

- [ ] **Step 1: Add the environment variable**

Create or append to `.env.local`:

```
NEXT_PUBLIC_LOGO_DEV_TOKEN=
```

Leave the value empty for now — logos will fall back to styled initials until a token is added. Get a free token at https://logo.dev.

- [ ] **Step 2: Commit**

No commit — `.env.local` is gitignored.

---

### Task 14: Smoke Test

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Navigate to watchlist page**

Open: `http://localhost:3000/watchlist`

- [ ] **Step 3: Verify collapsed card layout**

Expected:
- Cards show ticker initials (colored circle fallback since no Logo.dev token yet)
- Ticker, company name, market cap displayed
- Price and day change badge on right
- Performance pills showing returns for 1M, 3M, YTD, 1Y, 3Y, 5Y
- Some periods may show `—` for newer stocks

- [ ] **Step 4: Verify accordion expand/collapse**

Expected:
- Click a card → it expands showing price chart, financials grid, about section, analyst consensus
- Click another card → first collapses, second expands
- Click the expanded card → it collapses

- [ ] **Step 5: Final commit with all files**

```bash
git add -A
git commit -m "feat(watchlist): complete card redesign with logos, performance pills, and accordion detail view"
```
