# Phase 2: Core Portfolio Features — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete portfolio management experience — API routes for live market data, dashboard with portfolio cards and summary stats, create/delete portfolio flows, add holding with ticker search and lot tracking, holdings table with sorting and expandable rows, and the full portfolio detail page.

**Architecture:** Next.js API routes proxy yahoo-finance2 calls server-side. Client components read from Zustand stores (localStorage-persisted) and fetch live quote data via API routes. Computed values (market value, gain/loss, etc.) are derived at render time by merging store data with API quotes. No database — everything persists in localStorage via Zustand's persist middleware.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Zustand, yahoo-finance2, Recharts, shadcn/base-ui components, date-fns, Lucide icons

---

## Chunk 1: API Routes & Data Infrastructure

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install yahoo-finance2 and recharts**

```bash
npm install yahoo-finance2 recharts
```

- [ ] **Step 2: Verify the app still builds**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add yahoo-finance2 and recharts dependencies"
```

---

### Task 2: Quote API Route

**Files:**
- Create: `src/app/api/quote/route.ts`

- [ ] **Step 1: Create the single-ticker quote endpoint**

```typescript
// src/app/api/quote/route.ts
import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  try {
    const result = await yahooFinance.quote(ticker);

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
      sector: undefined, // quote() doesn't return sector; would need quoteSummary
      currency: result.currency ?? "USD",
    });
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch quote for ${ticker}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the route works**

```bash
npm run dev &
# Wait for server to start, then test:
curl "http://localhost:3000/api/quote?ticker=AAPL" | jq
```

Expected: JSON response with `ticker`, `currentPrice`, `name`, etc.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/quote/route.ts
git commit -m "feat: add /api/quote route for single-ticker quotes"
```

---

### Task 3: Batch Quotes API Route

**Files:**
- Create: `src/app/api/quotes/route.ts`

- [ ] **Step 1: Create the batch quotes endpoint**

```typescript
// src/app/api/quotes/route.ts
import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");

  if (!tickersParam) {
    return NextResponse.json(
      { error: "tickers parameter is required" },
      { status: 400 }
    );
  }

  const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "at least one ticker is required" },
      { status: 400 }
    );
  }

  try {
    const results = await Promise.allSettled(
      tickers.map((t) => yahooFinance.quote(t))
    );

    const quotes = results
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof yahooFinance.quote>>> =>
          r.status === "fulfilled"
      )
      .map((r) => {
        const result = r.value;
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
      });

    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test with multiple tickers**

```bash
curl "http://localhost:3000/api/quotes?tickers=AAPL,MSFT,VOO" | jq
```

Expected: Array of 3 quote objects.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/quotes/route.ts
git commit -m "feat: add /api/quotes route for batch ticker quotes"
```

---

### Task 4: Ticker Search API Route

**Files:**
- Create: `src/app/api/search/route.ts`

- [ ] **Step 1: Create the search/autocomplete endpoint**

```typescript
// src/app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const result = await yahooFinance.search(query, { newsCount: 0 });

    const results = (result.quotes ?? [])
      .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
      .slice(0, 10)
      .map((q) => ({
        ticker: q.symbol,
        name: q.shortname ?? q.longname ?? q.symbol,
        exchange: q.exchDisp ?? q.exchange ?? "",
        type: q.quoteType,
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test search**

```bash
curl "http://localhost:3000/api/search?q=vanguard" | jq
```

Expected: Array of search results with ticker, name, exchange.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "feat: add /api/search route for ticker autocomplete"
```

---

### Task 5: Historical Price Data API Route

**Files:**
- Create: `src/app/api/history/route.ts`

- [ ] **Step 1: Create the historical data endpoint**

```typescript
// src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";
import { subDays, subMonths, subYears } from "date-fns";

function getPeriodStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case "1w": return subDays(now, 7);
    case "1m": return subMonths(now, 1);
    case "3m": return subMonths(now, 3);
    case "6m": return subMonths(now, 6);
    case "1y": return subYears(now, 1);
    case "5y": return subYears(now, 5);
    case "max": return new Date("2000-01-01");
    default: return subYears(now, 1);
  }
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const period = request.nextUrl.searchParams.get("period") ?? "1y";

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  try {
    const startDate = getPeriodStartDate(period);

    const result = await yahooFinance.historical(ticker, {
      period1: startDate,
      interval: period === "1w" ? "1d" : period === "1m" ? "1d" : "1wk",
    });

    const data = result.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      close: item.close ?? item.adjClose ?? 0,
    }));

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch history for ${ticker}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test history endpoint**

```bash
curl "http://localhost:3000/api/history?ticker=VOO&period=3m" | jq
```

Expected: Array of `{ date, close }` objects.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/history/route.ts
git commit -m "feat: add /api/history route for historical price data"
```

---

### Task 6: Portfolio Calculations Utility

**Files:**
- Create: `src/utils/calculations.ts`

- [ ] **Step 1: Create the calculations module**

```typescript
// src/utils/calculations.ts
import type { Holding, Lot, HoldingWithQuote, QuoteData } from "@/types";

export function totalShares(lots: Lot[]): number {
  return lots.reduce((sum, lot) => sum + lot.shares, 0);
}

export function totalCost(lots: Lot[]): number {
  return lots.reduce((sum, lot) => sum + lot.shares * lot.costPerShare, 0);
}

export function avgCostBasis(lots: Lot[]): number {
  const shares = totalShares(lots);
  if (shares === 0) return 0;
  return totalCost(lots) / shares;
}

export function mergeHoldingWithQuote(
  holding: Holding,
  quote: QuoteData | undefined
): HoldingWithQuote {
  const shares = totalShares(holding.lots);
  const cost = totalCost(holding.lots);
  const price = quote?.currentPrice ?? 0;
  const marketVal = shares * price;
  const gl = marketVal - cost;

  return {
    ...holding,
    currentPrice: price,
    previousClose: quote?.previousClose ?? 0,
    dayChange: quote?.dayChange ?? 0,
    dayChangePercent: quote?.dayChangePercent ?? 0,
    totalShares: shares,
    avgCostBasis: avgCostBasis(holding.lots),
    marketValue: marketVal,
    totalCost: cost,
    gainLoss: gl,
    gainLossPercent: cost > 0 ? (gl / cost) * 100 : 0,
    peRatio: quote?.peRatio,
    fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: quote?.fiftyTwoWeekLow,
    sector: quote?.sector,
  };
}

export function portfolioTotals(holdings: HoldingWithQuote[]) {
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCostBasis = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPercent =
    totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const totalDayChange = holdings.reduce(
    (sum, h) => sum + h.totalShares * h.dayChange,
    0
  );
  const prevValue = totalValue - totalDayChange;
  const totalDayChangePercent =
    prevValue > 0 ? (totalDayChange / prevValue) * 100 : 0;

  return {
    totalValue,
    totalCost: totalCostBasis,
    totalGainLoss,
    totalGainLossPercent,
    totalDayChange,
    totalDayChangePercent,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/calculations.ts
git commit -m "feat: add portfolio calculation utilities"
```

---

### Task 7: Yahoo Finance Service (Client-Side Fetcher)

**Files:**
- Create: `src/services/yahooFinance.ts`

- [ ] **Step 1: Create the client-side API service**

```typescript
// src/services/yahooFinance.ts
import type { QuoteData, HistoricalDataPoint } from "@/types";

export async function fetchQuote(ticker: string): Promise<QuoteData> {
  const res = await fetch(`/api/quote?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error(`Failed to fetch quote for ${ticker}`);
  return res.json();
}

export async function fetchQuotes(tickers: string[]): Promise<QuoteData[]> {
  if (tickers.length === 0) return [];
  const res = await fetch(
    `/api/quotes?tickers=${tickers.map(encodeURIComponent).join(",")}`
  );
  if (!res.ok) throw new Error("Failed to fetch quotes");
  return res.json();
}

export async function searchTickers(
  query: string
): Promise<{ ticker: string; name: string; exchange: string; type: string }[]> {
  if (!query) return [];
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export async function fetchHistory(
  ticker: string,
  period: string = "1y"
): Promise<HistoricalDataPoint[]> {
  const res = await fetch(
    `/api/history?ticker=${encodeURIComponent(ticker)}&period=${period}`
  );
  if (!res.ok) throw new Error(`Failed to fetch history for ${ticker}`);
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/yahooFinance.ts
git commit -m "feat: add client-side Yahoo Finance service"
```

---

### Task 8: Custom Hooks for Data Fetching

**Files:**
- Create: `src/hooks/useQuotes.ts`
- Create: `src/hooks/useDebounce.ts`

- [ ] **Step 1: Create the useQuotes hook**

```typescript
// src/hooks/useQuotes.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { QuoteData } from "@/types";
import { fetchQuotes } from "@/services/yahooFinance";

export function useQuotes(tickers: string[]) {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickerKey = tickers.sort().join(",");

  const refetch = useCallback(async () => {
    if (tickers.length === 0) {
      setQuotes({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuotes(tickers);
      const map: Record<string, QuoteData> = {};
      for (const q of data) {
        map[q.ticker] = q;
      }
      setQuotes(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch quotes");
    } finally {
      setLoading(false);
    }
  }, [tickerKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (tickers.length === 0) return;
    const interval = setInterval(refetch, 60_000);
    return () => clearInterval(interval);
  }, [refetch, tickers.length]);

  return { quotes, loading, error, refetch };
}
```

- [ ] **Step 2: Create the useDebounce hook**

```typescript
// src/hooks/useDebounce.ts
"use client";

import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useQuotes.ts src/hooks/useDebounce.ts
git commit -m "feat: add useQuotes and useDebounce hooks"
```

---

### Task 9: Wire Up Market Overview Bar with Live Data

**Files:**
- Modify: `src/components/layout/MarketOverviewBar.tsx`

- [ ] **Step 1: Replace placeholder data with live API calls**

Replace the entire file content with:

```typescript
// src/components/layout/MarketOverviewBar.tsx
"use client";

import { MARKET_INDICES } from "@/utils/constants";
import { useQuotes } from "@/hooks/useQuotes";
import { Skeleton } from "@/components/ui/skeleton";

const indexTickers = MARKET_INDICES.map((i) => i.ticker);

export function MarketOverviewBar() {
  const { quotes, loading } = useQuotes(indexTickers);

  return (
    <div className="h-10 bg-bg-tertiary border-b border-border-primary flex items-center px-6 gap-8 overflow-x-auto">
      {MARKET_INDICES.map(({ ticker, name }) => {
        const quote = quotes[ticker];

        if (loading && !quote) {
          return (
            <div key={ticker} className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-text-secondary">{name}</span>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          );
        }

        if (!quote) return null;

        const isPositive = quote.dayChangePercent >= 0;

        return (
          <div key={ticker} className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-text-secondary">{name}</span>
            <span className="text-xs font-financial text-text-primary">
              {quote.currentPrice.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </span>
            <span
              className={`text-xs font-financial ${
                isPositive ? "text-green-primary" : "text-red-primary"
              }`}
            >
              {isPositive ? "+" : ""}
              {quote.dayChangePercent.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify the market bar renders with live data**

```bash
npm run dev
```

Open `http://localhost:3000` — the market overview bar should show live index prices.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/MarketOverviewBar.tsx
git commit -m "feat: wire market overview bar to live API data"
```

---

## Chunk 2: Create Portfolio Flow & Dashboard

### Task 10: Create Portfolio Dialog

**Files:**
- Create: `src/components/dashboard/CreatePortfolioDialog.tsx`

- [ ] **Step 1: Build the create portfolio dialog**

```typescript
// src/components/dashboard/CreatePortfolioDialog.tsx
"use client";

import { useState } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { DEFAULT_BENCHMARKS } from "@/utils/constants";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function CreatePortfolioDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [benchmark, setBenchmark] = useState("SPY");
  const createPortfolio = usePortfolioStore((s) => s.createPortfolio);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createPortfolio(name.trim(), description.trim() || undefined, benchmark);
    toast.success(`Portfolio "${name.trim()}" created`);
    setName("");
    setDescription("");
    setBenchmark("SPY");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<>{children}</>} />
      <DialogContent className="bg-bg-secondary border border-border-primary sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-text-primary font-display">
              Create Portfolio
            </DialogTitle>
            <DialogDescription className="text-text-secondary">
              Give your portfolio a name and choose a benchmark to track against.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label
                htmlFor="portfolio-name"
                className="text-sm text-text-secondary"
              >
                Name *
              </label>
              <Input
                id="portfolio-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Growth Portfolio"
                className="bg-bg-tertiary border-border-primary text-text-primary"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="portfolio-desc"
                className="text-sm text-text-secondary"
              >
                Description
              </label>
              <Input
                id="portfolio-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Long-term ETF holdings"
                className="bg-bg-tertiary border-border-primary text-text-primary"
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="portfolio-benchmark"
                className="text-sm text-text-secondary"
              >
                Benchmark
              </label>
              <select
                id="portfolio-benchmark"
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                className="h-8 rounded-lg border border-border-primary bg-bg-tertiary px-2.5 text-sm text-text-primary outline-none focus:border-green-primary"
              >
                {DEFAULT_BENCHMARKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-text-secondary"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create Portfolio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/CreatePortfolioDialog.tsx
git commit -m "feat: add CreatePortfolioDialog component"
```

---

### Task 11: Delete Portfolio Confirmation Dialog

**Files:**
- Create: `src/components/dashboard/DeletePortfolioDialog.tsx`

- [ ] **Step 1: Build the delete confirmation dialog**

```typescript
// src/components/dashboard/DeletePortfolioDialog.tsx
"use client";

import { useState } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DeletePortfolioDialog({
  portfolioId,
  portfolioName,
  children,
}: {
  portfolioId: string;
  portfolioName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const deletePortfolio = usePortfolioStore((s) => s.deletePortfolio);

  function handleDelete() {
    deletePortfolio(portfolioId);
    toast.success(`Portfolio "${portfolioName}" deleted`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<>{children}</>} />
      <DialogContent className="bg-bg-secondary border border-border-primary sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-text-primary font-display">
            Delete Portfolio
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Are you sure you want to delete &quot;{portfolioName}&quot;? This
            will remove all holdings and lots. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-text-secondary"
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete Portfolio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/DeletePortfolioDialog.tsx
git commit -m "feat: add DeletePortfolioDialog component"
```

---

### Task 12: Portfolio Summary Cards

**Files:**
- Create: `src/components/dashboard/PortfolioSummaryCards.tsx`

- [ ] **Step 1: Build the summary cards row**

```typescript
// src/components/dashboard/PortfolioSummaryCards.tsx
"use client";

import { formatCurrency, formatPercent } from "@/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryData {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
}

export function PortfolioSummaryCards({
  data,
  loading,
}: {
  data: SummaryData | null;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border-primary bg-bg-secondary p-5"
          >
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Portfolio Value",
      value: formatCurrency(data.totalValue),
      sub: null,
      bgClass: "",
    },
    {
      label: "Total Gain/Loss",
      value: formatCurrency(data.totalGainLoss),
      sub: formatPercent(data.totalGainLossPercent),
      bgClass:
        data.totalGainLoss >= 0 ? "bg-green-muted/30" : "bg-red-muted/30",
      colorClass:
        data.totalGainLoss >= 0 ? "text-green-primary" : "text-red-primary",
    },
    {
      label: "Day Change",
      value: formatCurrency(data.totalDayChange),
      sub: formatPercent(data.totalDayChangePercent),
      bgClass:
        data.totalDayChange >= 0 ? "bg-green-muted/30" : "bg-red-muted/30",
      colorClass:
        data.totalDayChange >= 0 ? "text-green-primary" : "text-red-primary",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border border-border-primary bg-bg-secondary p-5 ${card.bgClass}`}
        >
          <p className="text-xs text-text-secondary mb-1">{card.label}</p>
          <p
            className={`text-2xl font-financial ${card.colorClass ?? "text-text-primary"}`}
          >
            {card.value}
          </p>
          {card.sub && (
            <p
              className={`text-sm font-financial mt-1 ${card.colorClass ?? ""}`}
            >
              {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/PortfolioSummaryCards.tsx
git commit -m "feat: add PortfolioSummaryCards component"
```

---

### Task 13: Portfolio Card Component

**Files:**
- Create: `src/components/dashboard/PortfolioCard.tsx`

- [ ] **Step 1: Build the individual portfolio card**

```typescript
// src/components/dashboard/PortfolioCard.tsx
"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { Portfolio, QuoteData } from "@/types";
import { totalShares, totalCost } from "@/utils/calculations";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { DeletePortfolioDialog } from "./DeletePortfolioDialog";
import { Button } from "@/components/ui/button";

export function PortfolioCard({
  portfolio,
  quotes,
}: {
  portfolio: Portfolio;
  quotes: Record<string, QuoteData>;
}) {
  // Compute portfolio-level stats
  let marketValue = 0;
  let costBasis = 0;
  let dayChange = 0;

  for (const holding of portfolio.holdings) {
    const quote = quotes[holding.ticker];
    const shares = totalShares(holding.lots);
    const cost = totalCost(holding.lots);
    const price = quote?.currentPrice ?? 0;
    const dc = quote?.dayChange ?? 0;

    marketValue += shares * price;
    costBasis += cost;
    dayChange += shares * dc;
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
          <p className="text-xs text-text-tertiary mt-2">
            {portfolio.holdings.length} holding
            {portfolio.holdings.length !== 1 ? "s" : ""}
          </p>
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

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/PortfolioCard.tsx
git commit -m "feat: add PortfolioCard component"
```

---

### Task 14: Portfolio Grid

**Files:**
- Create: `src/components/dashboard/PortfolioGrid.tsx`

- [ ] **Step 1: Build the portfolio grid**

```typescript
// src/components/dashboard/PortfolioGrid.tsx
"use client";

import type { Portfolio, QuoteData } from "@/types";
import { PortfolioCard } from "./PortfolioCard";

export function PortfolioGrid({
  portfolios,
  quotes,
}: {
  portfolios: Portfolio[];
  quotes: Record<string, QuoteData>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {portfolios.map((portfolio) => (
        <PortfolioCard
          key={portfolio.id}
          portfolio={portfolio}
          quotes={quotes}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/PortfolioGrid.tsx
git commit -m "feat: add PortfolioGrid component"
```

---

### Task 15: Wire Up Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the dashboard page with the full implementation**

Replace the entire file content of `src/app/page.tsx`:

```typescript
// src/app/page.tsx
"use client";

import { useMemo } from "react";
import { TreeDeciduous, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useQuotes } from "@/hooks/useQuotes";
import { mergeHoldingWithQuote, portfolioTotals } from "@/utils/calculations";
import { CreatePortfolioDialog } from "@/components/dashboard/CreatePortfolioDialog";
import { PortfolioSummaryCards } from "@/components/dashboard/PortfolioSummaryCards";
import { PortfolioGrid } from "@/components/dashboard/PortfolioGrid";

export default function DashboardPage() {
  const portfolios = usePortfolioStore((s) => s.portfolios);

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
      <PortfolioGrid portfolios={portfolios} quotes={quotes} />
    </div>
  );
}
```

- [ ] **Step 2: Verify dashboard renders**

```bash
npm run dev
```

Open `http://localhost:3000`. Test:
1. Empty state with "Create Portfolio" button
2. Click "Create Portfolio" — dialog opens
3. Fill name, submit — portfolio card appears
4. Delete button on hover — confirm and delete

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: build full dashboard with summary cards and portfolio grid"
```

---

## Chunk 3: Add Holding Flow with Ticker Search

### Task 16: Ticker Search Component

**Files:**
- Create: `src/components/search/TickerSearch.tsx`

- [ ] **Step 1: Build the autocomplete ticker search**

```typescript
// src/components/search/TickerSearch.tsx
"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { searchTickers } from "@/services/yahooFinance";

interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

export function TickerSearch({
  onSelect,
}: {
  onSelect: (result: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    searchTickers(debouncedQuery)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a ticker or company..."
          className="pl-9 bg-bg-tertiary border-border-primary text-text-primary"
          autoFocus
        />
      </div>

      {(results.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-primary bg-bg-elevated shadow-lg max-h-64 overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-text-tertiary">
              Searching...
            </div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.ticker}-${r.exchange}`}
                type="button"
                onClick={() => {
                  onSelect(r);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-bg-tertiary transition-colors"
              >
                <div>
                  <span className="font-financial text-sm text-text-primary font-medium">
                    {r.ticker}
                  </span>
                  <span className="text-xs text-text-secondary ml-2">
                    {r.name}
                  </span>
                </div>
                <span className="text-xs text-text-tertiary">{r.exchange}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/TickerSearch.tsx
git commit -m "feat: add TickerSearch autocomplete component"
```

---

### Task 17: Add Holding Modal

**Files:**
- Create: `src/components/portfolio/AddHoldingModal.tsx`

- [ ] **Step 1: Build the add holding modal with two-step flow**

```typescript
// src/components/portfolio/AddHoldingModal.tsx
"use client";

import { useState } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { TickerSearch } from "@/components/search/TickerSearch";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface SelectedTicker {
  ticker: string;
  name: string;
  exchange: string;
}

export function AddHoldingModal({
  portfolioId,
  existingTickers,
  children,
}: {
  portfolioId: string;
  existingTickers: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<SelectedTicker | null>(null);
  const [shares, setShares] = useState("");
  const [costPerShare, setCostPerShare] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  const addHolding = usePortfolioStore((s) => s.addHolding);
  const addLot = usePortfolioStore((s) => s.addLot);
  const portfolios = usePortfolioStore((s) => s.portfolios);

  const isExistingTicker = selected
    ? existingTickers.includes(selected.ticker)
    : false;

  function resetForm() {
    setStep(1);
    setSelected(null);
    setShares("");
    setCostPerShare("");
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  }

  function handleSelect(result: {
    ticker: string;
    name: string;
    exchange: string;
  }) {
    setSelected(result);
    setStep(2);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !shares || !costPerShare) return;

    const sharesNum = parseFloat(shares);
    const costNum = parseFloat(costPerShare);
    if (sharesNum <= 0 || costNum <= 0) return;

    const currency = selected.ticker.endsWith(".TO") ? "CAD" : "USD";

    if (isExistingTicker) {
      // Find the existing holding and add a lot to it
      const portfolio = portfolios.find((p) => p.id === portfolioId);
      const holding = portfolio?.holdings.find(
        (h) => h.ticker === selected.ticker
      );
      if (holding) {
        addLot(portfolioId, holding.id, {
          shares: sharesNum,
          costPerShare: costNum,
          purchaseDate,
          notes: notes.trim() || undefined,
        });
      }
    } else {
      addHolding(portfolioId, {
        ticker: selected.ticker,
        name: selected.name,
        currency: currency as "CAD" | "USD",
        lots: [
          {
            id: "", // will be overwritten by store
            shares: sharesNum,
            costPerShare: costNum,
            purchaseDate,
            notes: notes.trim() || undefined,
          },
        ],
        notes: undefined,
      });
    }

    toast.success(
      `Added ${sharesNum} shares of ${selected.ticker}${isExistingTicker ? " (new lot)" : ""}`
    );
    resetForm();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger render={<>{children}</>} />
      <DialogContent className="bg-bg-secondary border border-border-primary sm:max-w-md">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-text-primary font-display">
                Add Holding
              </DialogTitle>
              <DialogDescription className="text-text-secondary">
                Search for a ticker symbol or company name.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <TickerSearch onSelect={handleSelect} />
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-text-primary font-display">
                <span className="font-financial text-green-primary">
                  {selected?.ticker}
                </span>{" "}
                — {selected?.name}
              </DialogTitle>
              {isExistingTicker && (
                <DialogDescription className="text-oak-300">
                  Adding a new lot to existing {selected?.ticker} holding.
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm text-text-secondary">
                    Shares *
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="100"
                    className="bg-bg-tertiary border-border-primary text-text-primary font-financial"
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-text-secondary">
                    Cost Per Share *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={costPerShare}
                      onChange={(e) => setCostPerShare(e.target.value)}
                      placeholder="150.00"
                      className="pl-6 bg-bg-tertiary border-border-primary text-text-primary font-financial"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-text-secondary">
                  Purchase Date
                </label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="bg-bg-tertiary border-border-primary text-text-primary"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-text-secondary">Notes</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="bg-bg-tertiary border-border-primary text-text-primary"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="text-text-secondary"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={!shares || !costPerShare}
              >
                {isExistingTicker ? "Add Lot" : "Add Holding"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portfolio/AddHoldingModal.tsx
git commit -m "feat: add AddHoldingModal with ticker search and lot details"
```

---

## Chunk 4: Portfolio Detail Page with Holdings Table

### Task 18: Holdings Table Component

**Files:**
- Create: `src/components/portfolio/HoldingsTable.tsx`

- [ ] **Step 1: Build the sortable, expandable holdings table**

```typescript
// src/components/portfolio/HoldingsTable.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { HoldingWithQuote } from "@/types";
import { formatCurrency, formatPercent, formatDate } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { toast } from "sonner";

type SortKey =
  | "ticker"
  | "totalShares"
  | "avgCostBasis"
  | "currentPrice"
  | "marketValue"
  | "gainLoss"
  | "gainLossPercent"
  | "dayChangePercent";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "totalShares", label: "Shares", align: "right" },
  { key: "avgCostBasis", label: "Avg Cost", align: "right" },
  { key: "currentPrice", label: "Price", align: "right" },
  { key: "marketValue", label: "Market Value", align: "right" },
  { key: "gainLoss", label: "Gain/Loss", align: "right" },
  { key: "gainLossPercent", label: "G/L %", align: "right" },
  { key: "dayChangePercent", label: "Day %", align: "right" },
];

export function HoldingsTable({
  holdings,
  portfolioId,
}: {
  holdings: HoldingWithQuote[];
  portfolioId: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const removeHolding = usePortfolioStore((s) => s.removeHolding);
  const removeLot = usePortfolioStore((s) => s.removeLot);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "ticker"); // alpha ascending by default
    }
  }

  const sorted = [...holdings].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (typeof va === "string" && typeof vb === "string") {
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    const na = Number(va) || 0;
    const nb = Number(vb) || 0;
    return sortAsc ? na - nb : nb - na;
  });

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-secondary">
              <th className="w-8 px-3 py-3" /> {/* expand toggle */}
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-3 font-medium text-text-secondary cursor-pointer hover:text-text-primary transition-colors select-none ${col.align === "right" ? "text-right" : "text-left"}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 text-green-primary">
                      {sortAsc ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
              <th className="w-10 px-3 py-3" /> {/* actions */}
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => {
              const isExpanded = expandedId === h.id;
              return (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  isExpanded={isExpanded}
                  onToggle={() =>
                    setExpandedId(isExpanded ? null : h.id)
                  }
                  onRemoveHolding={() => {
                    removeHolding(portfolioId, h.id);
                    toast.success(`Removed ${h.ticker}`);
                  }}
                  onRemoveLot={(lotId) => {
                    removeLot(portfolioId, h.id, lotId);
                    toast.success("Lot removed");
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {holdings.length === 0 && (
        <div className="p-8 text-center text-text-tertiary text-sm">
          No holdings yet. Add your first holding to get started.
        </div>
      )}
    </div>
  );
}

function HoldingRow({
  holding,
  isExpanded,
  onToggle,
  onRemoveHolding,
  onRemoveLot,
}: {
  holding: HoldingWithQuote;
  isExpanded: boolean;
  onToggle: () => void;
  onRemoveHolding: () => void;
  onRemoveLot: (lotId: string) => void;
}) {
  const h = holding;
  const glColor = h.gainLoss >= 0 ? "text-green-primary" : "text-red-primary";
  const dcColor =
    h.dayChangePercent >= 0 ? "text-green-primary" : "text-red-primary";

  return (
    <>
      <tr
        className="border-b border-border-secondary hover:bg-bg-tertiary/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-3 py-3 text-text-tertiary">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-3 py-3">
          <div>
            <span className="font-financial font-medium text-text-primary">
              {h.ticker}
            </span>
            <span className="block text-xs text-text-tertiary truncate max-w-[140px]">
              {h.name}
            </span>
          </div>
        </td>
        <td className="px-3 py-3 text-right font-financial text-text-primary">
          {h.totalShares.toFixed(h.totalShares % 1 === 0 ? 0 : 3)}
        </td>
        <td className="px-3 py-3 text-right font-financial text-text-primary">
          {formatCurrency(h.avgCostBasis)}
        </td>
        <td className="px-3 py-3 text-right font-financial text-text-primary">
          {formatCurrency(h.currentPrice)}
        </td>
        <td className="px-3 py-3 text-right font-financial text-text-primary">
          {formatCurrency(h.marketValue)}
        </td>
        <td className={`px-3 py-3 text-right font-financial ${glColor}`}>
          {formatCurrency(h.gainLoss)}
        </td>
        <td className={`px-3 py-3 text-right font-financial ${glColor}`}>
          {formatPercent(h.gainLossPercent)}
        </td>
        <td className={`px-3 py-3 text-right font-financial ${dcColor}`}>
          {formatPercent(h.dayChangePercent)}
        </td>
        <td className="px-3 py-3">
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-text-tertiary hover:text-red-primary"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveHolding();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </td>
      </tr>

      {/* Expanded lot detail */}
      {isExpanded && (
        <tr>
          <td colSpan={10} className="bg-bg-tertiary/30 px-6 py-3">
            <div className="text-xs text-text-secondary mb-2 font-medium">
              Lots
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-tertiary">
                  <th className="text-left py-1 pr-4">Purchase Date</th>
                  <th className="text-right py-1 pr-4">Shares</th>
                  <th className="text-right py-1 pr-4">Cost/Share</th>
                  <th className="text-right py-1 pr-4">Total Cost</th>
                  <th className="text-right py-1 pr-4">Current Value</th>
                  <th className="text-right py-1 pr-4">Gain/Loss</th>
                  <th className="w-8 py-1" />
                </tr>
              </thead>
              <tbody>
                {h.lots.map((lot) => {
                  const lotValue = lot.shares * h.currentPrice;
                  const lotCost = lot.shares * lot.costPerShare;
                  const lotGL = lotValue - lotCost;
                  const lotGLColor =
                    lotGL >= 0 ? "text-green-primary" : "text-red-primary";

                  return (
                    <tr
                      key={lot.id}
                      className="border-t border-border-secondary/50"
                    >
                      <td className="py-1.5 pr-4 text-text-primary">
                        {formatDate(lot.purchaseDate)}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-financial text-text-primary">
                        {lot.shares}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-financial text-text-primary">
                        {formatCurrency(lot.costPerShare)}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-financial text-text-primary">
                        {formatCurrency(lotCost)}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-financial text-text-primary">
                        {formatCurrency(lotValue)}
                      </td>
                      <td
                        className={`py-1.5 pr-4 text-right font-financial ${lotGLColor}`}
                      >
                        {formatCurrency(lotGL)}
                      </td>
                      <td className="py-1.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-text-tertiary hover:text-red-primary"
                          onClick={() => onRemoveLot(lot.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {h.sector && (
              <div className="mt-2 text-xs text-text-tertiary">
                Sector: {h.sector}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portfolio/HoldingsTable.tsx
git commit -m "feat: add HoldingsTable with sorting and expandable lot rows"
```

---

### Task 19: Portfolio Header Component

**Files:**
- Create: `src/components/portfolio/PortfolioHeader.tsx`

- [ ] **Step 1: Build the portfolio header with inline editing**

```typescript
// src/components/portfolio/PortfolioHeader.tsx
"use client";

import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import type { Portfolio } from "@/types";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { DEFAULT_BENCHMARKS } from "@/utils/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeletePortfolioDialog } from "@/components/dashboard/DeletePortfolioDialog";
import { AddHoldingModal } from "./AddHoldingModal";

export function PortfolioHeader({ portfolio }: { portfolio: Portfolio }) {
  const updatePortfolio = usePortfolioStore((s) => s.updatePortfolio);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(portfolio.name);

  function saveName() {
    if (nameValue.trim() && nameValue.trim() !== portfolio.name) {
      updatePortfolio(portfolio.id, { name: nameValue.trim() });
    }
    setEditingName(false);
  }

  const existingTickers = portfolio.holdings.map((h) => h.ticker);

  return (
    <div className="mb-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <div className="flex items-start justify-between">
        <div>
          {editingName ? (
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setNameValue(portfolio.name);
                  setEditingName(false);
                }
              }}
              className="font-display text-2xl bg-transparent border-border-primary text-text-primary h-auto py-1 px-2 -ml-2"
              autoFocus
            />
          ) : (
            <h1
              className="font-display text-2xl text-text-primary cursor-pointer hover:text-green-primary transition-colors"
              onClick={() => setEditingName(true)}
              title="Click to edit"
            >
              {portfolio.name}
            </h1>
          )}
          {portfolio.description && (
            <p className="text-sm text-text-secondary mt-1">
              {portfolio.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-text-tertiary">Benchmark:</span>
            <select
              value={portfolio.benchmark}
              onChange={(e) =>
                updatePortfolio(portfolio.id, { benchmark: e.target.value })
              }
              className="text-xs rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-text-primary outline-none"
            >
              {DEFAULT_BENCHMARKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AddHoldingModal
            portfolioId={portfolio.id}
            existingTickers={existingTickers}
          >
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Holding
            </Button>
          </AddHoldingModal>
          <DeletePortfolioDialog
            portfolioId={portfolio.id}
            portfolioName={portfolio.name}
          >
            <Button variant="destructive" size="sm">
              Delete
            </Button>
          </DeletePortfolioDialog>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portfolio/PortfolioHeader.tsx
git commit -m "feat: add PortfolioHeader with inline name editing and benchmark selector"
```

---

### Task 20: Performance Summary Bar

**Files:**
- Create: `src/components/portfolio/PerformanceSummaryBar.tsx`

- [ ] **Step 1: Build the performance stats bar**

```typescript
// src/components/portfolio/PerformanceSummaryBar.tsx
"use client";

import { formatCurrency, formatPercent } from "@/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";

interface PerformanceData {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
}

export function PerformanceSummaryBar({
  data,
  loading,
}: {
  data: PerformanceData | null;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="flex gap-6 mb-6 flex-wrap">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i}>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Current Value",
      value: formatCurrency(data.totalValue),
      color: "text-text-primary",
    },
    {
      label: "Total Gain/Loss",
      value: formatCurrency(data.totalGainLoss),
      color:
        data.totalGainLoss >= 0 ? "text-green-primary" : "text-red-primary",
    },
    {
      label: "Total Return",
      value: formatPercent(data.totalGainLossPercent),
      color:
        data.totalGainLossPercent >= 0
          ? "text-green-primary"
          : "text-red-primary",
    },
    {
      label: "Day Change",
      value: formatCurrency(data.totalDayChange),
      color:
        data.totalDayChange >= 0 ? "text-green-primary" : "text-red-primary",
    },
    {
      label: "Day %",
      value: formatPercent(data.totalDayChangePercent),
      color:
        data.totalDayChangePercent >= 0
          ? "text-green-primary"
          : "text-red-primary",
    },
  ];

  return (
    <div className="flex gap-6 mb-6 flex-wrap">
      {stats.map((s) => (
        <div key={s.label}>
          <p className="text-xs text-text-tertiary">{s.label}</p>
          <p className={`text-lg font-financial ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portfolio/PerformanceSummaryBar.tsx
git commit -m "feat: add PerformanceSummaryBar component"
```

---

### Task 21: Portfolio Detail Page

**Files:**
- Create: `src/app/portfolio/[id]/page.tsx`

- [ ] **Step 1: Create the portfolio detail route and page**

```typescript
// src/app/portfolio/[id]/page.tsx
"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useQuotes } from "@/hooks/useQuotes";
import { mergeHoldingWithQuote, portfolioTotals } from "@/utils/calculations";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { PerformanceSummaryBar } from "@/components/portfolio/PerformanceSummaryBar";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { AddHoldingModal } from "@/components/portfolio/AddHoldingModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = params.id as string;

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

      <HoldingsTable
        holdings={holdingsWithQuotes}
        portfolioId={portfolio.id}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the full flow end-to-end**

```bash
npm run dev
```

Test the complete flow:
1. Create a portfolio from the dashboard
2. Click the portfolio card → navigates to `/portfolio/[id]`
3. Click "Add Holding" → search for a ticker (e.g., "AAPL")
4. Enter shares and cost → submit
5. Holding appears in the table with live price data
6. Click the row to expand and see lot details
7. Delete a lot, delete a holding
8. Sort columns by clicking headers
9. Navigate back to dashboard — summary cards show aggregated data

- [ ] **Step 3: Commit**

```bash
git add src/app/portfolio/
git commit -m "feat: add portfolio detail page with holdings table and live quotes"
```

---

### Task 22: Final Build Verification

- [ ] **Step 1: Run the production build**

```bash
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 2: Run the linter**

```bash
npm run lint
```

Expected: No lint errors (or only pre-existing warnings).

- [ ] **Step 3: Commit any final fixes**

If the build or lint revealed issues, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve build/lint issues from Phase 2 implementation"
```

---

## File Summary

### New Files (17)
| File | Purpose |
|------|---------|
| `src/app/api/quote/route.ts` | Single-ticker quote endpoint |
| `src/app/api/quotes/route.ts` | Batch quotes endpoint |
| `src/app/api/search/route.ts` | Ticker search/autocomplete endpoint |
| `src/app/api/history/route.ts` | Historical price data endpoint |
| `src/utils/calculations.ts` | Portfolio math (totals, averages, gain/loss) |
| `src/services/yahooFinance.ts` | Client-side fetch wrappers for API routes |
| `src/hooks/useQuotes.ts` | React hook for fetching + caching live quotes |
| `src/hooks/useDebounce.ts` | Debounce utility hook |
| `src/components/dashboard/CreatePortfolioDialog.tsx` | Create portfolio form dialog |
| `src/components/dashboard/DeletePortfolioDialog.tsx` | Delete confirmation dialog |
| `src/components/dashboard/PortfolioSummaryCards.tsx` | Dashboard summary cards |
| `src/components/dashboard/PortfolioCard.tsx` | Individual portfolio card |
| `src/components/dashboard/PortfolioGrid.tsx` | Grid layout for portfolio cards |
| `src/components/search/TickerSearch.tsx` | Autocomplete ticker search |
| `src/components/portfolio/AddHoldingModal.tsx` | Two-step add holding modal |
| `src/components/portfolio/HoldingsTable.tsx` | Sortable table with expandable lots |
| `src/components/portfolio/PortfolioHeader.tsx` | Portfolio header with inline edit |
| `src/components/portfolio/PerformanceSummaryBar.tsx` | Performance stats row |
| `src/app/portfolio/[id]/page.tsx` | Portfolio detail page |

### Modified Files (2)
| File | Change |
|------|--------|
| `src/app/page.tsx` | Full dashboard implementation replacing skeleton |
| `src/components/layout/MarketOverviewBar.tsx` | Live API data replacing placeholders |
