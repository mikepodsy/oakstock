# Calendar Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/calendar` page with sidebar navigation for Earnings, Dividend, Economic, and IPO calendars, populated with real FMP API data, with table and grid views plus portfolio stock highlighting.

**Architecture:** FMP API proxied through Next.js API routes (matching existing Yahoo Finance pattern), cached server-side with 1-hour TTL. Client-side hook fetches data and cross-references portfolio/watchlist stores for highlighting. Page uses sidebar layout with table/grid view toggle.

**Tech Stack:** Next.js App Router, FMP API, Tailwind CSS, shadcn/ui, date-fns, Lucide icons, Zustand stores

**Spec:** `docs/superpowers/specs/2026-03-19-calendar-page-design.md`

---

## Chunk 1: Data Layer (Types, Cache, API Route, Service, Hook)

### Task 1: Add calendar types

**Files:**
- Modify: `src/types/index.ts` (replace existing `CalendarEvent` at line 156-161 with expanded types)

- [ ] **Step 1: Replace the existing CalendarEvent types in `src/types/index.ts`**

Replace the existing `CalendarEvent` interface (lines 155-161) with the full calendar type system:

```typescript
// ─── Calendar ───────────────────────────────────────
export type CalendarType = 'earnings' | 'dividends' | 'economic' | 'ipo';

export interface EarningsEvent {
  date: string;
  symbol: string;
  company: string;
  epsEstimated: number | null;
  epsActual: number | null;
  revenueEstimated: number | null;
  revenueActual: number | null;
  time: 'bmo' | 'amc' | null;
  isPortfolioStock: boolean;
}

export interface DividendEvent {
  date: string;
  symbol: string;
  company: string;
  dividend: number;
  yield: number | null;
  paymentDate: string | null;
  recordDate: string | null;
  isPortfolioStock: boolean;
}

export interface EconomicEvent {
  date: string;
  event: string;
  country: string;
  previous: number | null;
  forecast: number | null;
  actual: number | null;
  impact: 'High' | 'Medium' | 'Low';
}

export interface IpoEvent {
  date: string;
  symbol: string;
  company: string;
  exchange: string;
  priceRange: string | null;
  sharesOffered: number | null;
  marketCap: number | null;
  isPortfolioStock: boolean;
}

export type CalendarEvent = EarningsEvent | DividendEvent | EconomicEvent | IpoEvent;
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(calendar): add calendar event type definitions"
```

---

### Task 2: Add calendar cache

**Files:**
- Modify: `src/lib/cache.ts` (add one line at the end)

- [ ] **Step 1: Add calendarCache to `src/lib/cache.ts`**

Add after the existing `fundamentalsCache` line (line 50):

```typescript
export const calendarCache = getOrCreateCache<Record<string, unknown>>("calendar", 3600);
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cache.ts
git commit -m "feat(calendar): add calendar cache with 1-hour TTL"
```

---

### Task 3: Create the FMP API route

**Files:**
- Create: `src/app/api/calendar/[type]/route.ts`

- [ ] **Step 1: Create the dynamic API route**

Create `src/app/api/calendar/[type]/route.ts`. Follow the same pattern as `src/app/api/financials/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { calendarCache } from "@/lib/cache";

const FMP_BASE = "https://financialmodelingprep.com/api/v3";
const VALID_TYPES = ["earnings", "dividends", "economic", "ipo"] as const;

const ENDPOINT_MAP: Record<string, string> = {
  earnings: "earning_calendar",
  dividends: "stock_dividend_calendar",
  economic: "economic_calendar",
  ipo: "ipo_calendar",
};

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
};

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function defaultDateRange() {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 30);
  return { from: formatDate(from), to: formatDate(to) };
}

// Normalize FMP responses to our app types
function normalizeEarnings(items: Record<string, unknown>[]) {
  return items.map((item) => ({
    date: item.date as string,
    symbol: item.symbol as string,
    company: (item.symbol as string) ?? "",
    epsEstimated: item.epsEstimated != null ? Number(item.epsEstimated) : null,
    epsActual: item.eps != null ? Number(item.eps) : null,
    revenueEstimated: item.revenueEstimated != null ? Number(item.revenueEstimated) : null,
    revenueActual: item.revenue != null ? Number(item.revenue) : null,
    time: item.updatedFromDate ? "bmo" : null,
    isPortfolioStock: false,
  }));
}

function normalizeDividends(items: Record<string, unknown>[]) {
  return items.map((item) => ({
    date: item.date as string,
    symbol: item.symbol as string,
    company: (item.label as string) ?? (item.symbol as string) ?? "",
    dividend: Number(item.dividend ?? item.adjDividend ?? 0),
    yield: null,
    paymentDate: (item.paymentDate as string) ?? null,
    recordDate: (item.recordDate as string) ?? null,
    isPortfolioStock: false,
  }));
}

function normalizeEconomic(items: Record<string, unknown>[]) {
  return items.map((item) => ({
    date: item.date as string,
    event: item.event as string,
    country: item.country as string,
    previous: item.previous != null ? Number(item.previous) : null,
    forecast: item.estimate != null ? Number(item.estimate) : null,
    actual: item.actual != null ? Number(item.actual) : null,
    impact: (item.impact as string) ?? "Low",
  }));
}

function normalizeIpo(items: Record<string, unknown>[]) {
  return items.map((item) => ({
    date: item.date as string,
    symbol: (item.symbol as string) ?? "",
    company: (item.company as string) ?? "",
    exchange: (item.exchange as string) ?? "",
    priceRange: (item.priceRange as string) ?? null,
    sharesOffered: item.shares != null ? Number(item.shares) : null,
    marketCap: item.marketCap != null ? Number(item.marketCap) : null,
    isPortfolioStock: false,
  }));
}

const NORMALIZERS: Record<string, (items: Record<string, unknown>[]) => unknown[]> = {
  earnings: normalizeEarnings,
  dividends: normalizeDividends,
  economic: normalizeEconomic,
  ipo: normalizeIpo,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;

  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json(
      { error: `Invalid calendar type: ${type}. Must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const defaults = defaultDateRange();
  const dateFrom = from || defaults.from;
  const dateTo = to || defaults.to;

  const cacheKey = `${type}:${dateFrom}:${dateTo}`;
  const cached = calendarCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FMP_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const endpoint = ENDPOINT_MAP[type];
    const url = `${FMP_BASE}/${endpoint}?from=${dateFrom}&to=${dateTo}&apikey=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `FMP API error: ${text}` },
        { status: res.status }
      );
    }

    const raw = await res.json();
    const items = Array.isArray(raw) ? raw : [];
    const normalized = NORMALIZERS[type](items);

    calendarCache.set(cacheKey, normalized);
    return NextResponse.json(normalized, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch ${type} calendar` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/calendar/
git commit -m "feat(calendar): add FMP-backed calendar API route with normalization"
```

---

### Task 4: Create calendar service

**Files:**
- Create: `src/services/calendarService.ts`

- [ ] **Step 1: Create `src/services/calendarService.ts`**

Follow the same pattern as `src/services/yahooFinance.ts`:

```typescript
import type { CalendarType, CalendarEvent } from "@/types";

export async function fetchCalendarData(
  type: CalendarType,
  from: string,
  to: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/calendar/${type}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type} calendar`);
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/calendarService.ts
git commit -m "feat(calendar): add calendar service layer"
```

---

### Task 5: Create useCalendar hook

**Files:**
- Create: `src/hooks/useCalendar.ts`

- [ ] **Step 1: Create `src/hooks/useCalendar.ts`**

Follow the pattern from `src/hooks/useQuotes.ts` — useState/useEffect/useCallback with auto-refresh:

```typescript
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { CalendarType, CalendarEvent } from "@/types";
import { fetchCalendarData } from "@/services/calendarService";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useWatchlistStore } from "@/stores/watchlistStore";

export function useCalendar(type: CalendarType, from: string, to: string) {
  const [data, setData] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portfolios = usePortfolioStore((s) => s.portfolios);
  const watchlists = useWatchlistStore((s) => s.watchlists);

  // Build a set of all tickers the user owns or watches
  const userTickers = useMemo(() => {
    const tickers = new Set<string>();
    for (const p of portfolios) {
      for (const h of p.holdings) {
        tickers.add(h.ticker.toUpperCase());
      }
    }
    for (const w of watchlists) {
      for (const item of w.items) {
        tickers.add(item.ticker.toUpperCase());
      }
    }
    return tickers;
  }, [portfolios, watchlists]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const events = await fetchCalendarData(type, from, to);
      // Flag portfolio/watchlist stocks client-side
      const flagged = events.map((event) => {
        if ("symbol" in event && event.symbol) {
          return {
            ...event,
            isPortfolioStock: userTickers.has(event.symbol.toUpperCase()),
          };
        }
        return event;
      });
      setData(flagged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch calendar data");
    } finally {
      setLoading(false);
    }
  }, [type, from, to, userTickers]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(refetch, 900_000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { data, loading, error, refetch };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCalendar.ts
git commit -m "feat(calendar): add useCalendar hook with portfolio highlighting"
```

---

## Chunk 2: UI Components

### Task 6: Add Calendar to navbar

**Files:**
- Modify: `src/components/layout/Navbar.tsx` (line 17-22, the NAV_LINKS array)

- [ ] **Step 1: Add Calendar link to `NAV_LINKS` in `src/components/layout/Navbar.tsx`**

Change the `NAV_LINKS` array (line 17-22) to include Calendar between Radar and Rebalance:

```typescript
const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/radar", label: "Radar" },
  { href: "/calendar", label: "Calendar" },
  { href: "/rebalance", label: "Rebalance" },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Navbar.tsx
git commit -m "feat(calendar): add Calendar link to navbar"
```

---

### Task 7: Create CalendarSidebar component

**Files:**
- Create: `src/components/calendar/CalendarSidebar.tsx`

- [ ] **Step 1: Create `src/components/calendar/CalendarSidebar.tsx`**

```typescript
"use client";

import { TrendingUp, DollarSign, Globe, Rocket } from "lucide-react";
import type { CalendarType } from "@/types";

const CALENDAR_CATEGORIES: {
  type: CalendarType;
  label: string;
  icon: React.ElementType;
}[] = [
  { type: "earnings", label: "Earnings", icon: TrendingUp },
  { type: "dividends", label: "Dividends", icon: DollarSign },
  { type: "economic", label: "Economic", icon: Globe },
  { type: "ipo", label: "IPO", icon: Rocket },
];

interface CalendarSidebarProps {
  selected: CalendarType;
  onSelect: (type: CalendarType) => void;
  counts: Record<CalendarType, number>;
}

export function CalendarSidebar({ selected, onSelect, counts }: CalendarSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 bg-bg-secondary rounded-xl border border-border-primary p-2 gap-1 h-fit">
        {CALENDAR_CATEGORIES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
              selected === type
                ? "text-green-primary bg-green-muted border-l-2 border-green-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {counts[type] > 0 && (
              <span className="text-xs bg-bg-tertiary text-text-tertiary px-1.5 py-0.5 rounded-full">
                {counts[type]}
              </span>
            )}
          </button>
        ))}
      </aside>

      {/* Mobile horizontal tabs */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-2 border-b border-border-primary mb-4">
        {CALENDAR_CATEGORIES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selected === type
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/CalendarSidebar.tsx
git commit -m "feat(calendar): add CalendarSidebar with desktop/mobile layouts"
```

---

### Task 8: Create CalendarHeader component

**Files:**
- Create: `src/components/calendar/CalendarHeader.tsx`

- [ ] **Step 1: Create `src/components/calendar/CalendarHeader.tsx`**

```typescript
"use client";

import { Table, CalendarDays } from "lucide-react";

export type ViewMode = "table" | "grid";
export type DatePreset = "this-week" | "this-month" | "next-month";

interface CalendarHeaderProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  from: string;
  to: string;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "this-week", label: "This Week" },
  { key: "this-month", label: "This Month" },
  { key: "next-month", label: "Next Month" },
];

export function CalendarHeader({
  view,
  onViewChange,
  datePreset,
  onDatePresetChange,
  from,
  to,
  onFromChange,
  onToChange,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Date presets */}
      <div className="flex items-center gap-1">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onDatePresetChange(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              datePreset === key
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="flex items-center gap-2 ml-auto">
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="bg-bg-tertiary text-text-primary text-sm px-2 py-1.5 rounded-lg border border-border-primary"
        />
        <span className="text-text-tertiary text-sm">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="bg-bg-tertiary text-text-primary text-sm px-2 py-1.5 rounded-lg border border-border-primary"
        />
      </div>

      {/* View toggle */}
      <div className="flex items-center bg-bg-tertiary rounded-lg p-0.5">
        <button
          onClick={() => onViewChange("table")}
          className={`p-1.5 rounded-md transition-colors ${
            view === "table" ? "bg-bg-elevated text-text-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
          title="Table view"
        >
          <Table className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewChange("grid")}
          className={`p-1.5 rounded-md transition-colors ${
            view === "grid" ? "bg-bg-elevated text-text-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
          title="Calendar view"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/CalendarHeader.tsx
git commit -m "feat(calendar): add CalendarHeader with date presets and view toggle"
```

---

### Task 9: Create table components (EarningsTable, DividendTable, EconomicTable, IpoTable)

**Files:**
- Create: `src/components/calendar/EarningsTable.tsx`
- Create: `src/components/calendar/DividendTable.tsx`
- Create: `src/components/calendar/EconomicTable.tsx`
- Create: `src/components/calendar/IpoTable.tsx`

- [ ] **Step 1: Create `src/components/calendar/EarningsTable.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { EarningsEvent } from "@/types";
import { Briefcase } from "lucide-react";

interface EarningsTableProps {
  data: EarningsEvent[];
}

type SortKey = "date" | "symbol" | "epsEstimated" | "epsActual" | "revenueEstimated";

export function EarningsTable({ data }: EarningsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary text-text-tertiary">
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("date")}>Date{sortIndicator("date")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("symbol")}>Company{sortIndicator("symbol")}</th>
            <th className="text-right py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("epsEstimated")}>EPS Est.{sortIndicator("epsEstimated")}</th>
            <th className="text-right py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("epsActual")}>EPS Actual{sortIndicator("epsActual")}</th>
            <th className="text-right py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("revenueEstimated")}>Revenue Est.{sortIndicator("revenueEstimated")}</th>
            <th className="text-center py-3 px-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((event, i) => (
            <tr
              key={`${event.symbol}-${event.date}-${i}`}
              className={`border-b border-border-secondary hover:bg-bg-tertiary transition-colors ${
                event.isPortfolioStock ? "bg-bg-elevated border-l-2 border-l-green-primary" : ""
              }`}
            >
              <td className="py-3 px-3 text-text-primary">{event.date}</td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  {event.isPortfolioStock && <Briefcase className="h-3.5 w-3.5 text-green-primary" />}
                  <span className="text-text-primary font-medium">{event.symbol}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.epsEstimated?.toFixed(2) ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.epsActual?.toFixed(2) ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">
                {event.revenueEstimated ? `$${(event.revenueEstimated / 1e9).toFixed(2)}B` : "—"}
              </td>
              <td className="py-3 px-3 text-center">
                {event.time && (
                  <span className="text-xs bg-bg-tertiary text-text-secondary px-2 py-0.5 rounded-full uppercase">
                    {event.time}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/calendar/DividendTable.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { DividendEvent } from "@/types";
import { Briefcase } from "lucide-react";

interface DividendTableProps {
  data: DividendEvent[];
}

type SortKey = "date" | "symbol" | "dividend" | "paymentDate";

export function DividendTable({ data }: DividendTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary text-text-tertiary">
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("date")}>Ex-Date{sortIndicator("date")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("symbol")}>Company{sortIndicator("symbol")}</th>
            <th className="text-right py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("dividend")}>Amount{sortIndicator("dividend")}</th>
            <th className="text-right py-3 px-3 font-medium">Yield</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("paymentDate")}>Payment Date{sortIndicator("paymentDate")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((event, i) => (
            <tr
              key={`${event.symbol}-${event.date}-${i}`}
              className={`border-b border-border-secondary hover:bg-bg-tertiary transition-colors ${
                event.isPortfolioStock ? "bg-bg-elevated border-l-2 border-l-green-primary" : ""
              }`}
            >
              <td className="py-3 px-3 text-text-primary">{event.date}</td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  {event.isPortfolioStock && <Briefcase className="h-3.5 w-3.5 text-green-primary" />}
                  <span className="text-text-primary font-medium">{event.symbol}</span>
                  <span className="text-text-tertiary text-xs">{event.company}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-right text-text-primary">${event.dividend.toFixed(4)}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.yield ? `${(event.yield * 100).toFixed(2)}%` : "—"}</td>
              <td className="py-3 px-3 text-text-secondary">{event.paymentDate ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/calendar/EconomicTable.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { EconomicEvent } from "@/types";

interface EconomicTableProps {
  data: EconomicEvent[];
}

type SortKey = "date" | "event" | "country" | "impact";

const IMPACT_STYLES: Record<string, string> = {
  High: "bg-red-muted text-red-primary",
  Medium: "bg-yellow-900/20 text-yellow-500",
  Low: "bg-bg-tertiary text-text-tertiary",
};

export function EconomicTable({ data }: EconomicTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary text-text-tertiary">
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("date")}>Date{sortIndicator("date")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("event")}>Event{sortIndicator("event")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("country")}>Country{sortIndicator("country")}</th>
            <th className="text-right py-3 px-3 font-medium">Previous</th>
            <th className="text-right py-3 px-3 font-medium">Forecast</th>
            <th className="text-right py-3 px-3 font-medium">Actual</th>
            <th className="text-center py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("impact")}>Impact{sortIndicator("impact")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((event, i) => (
            <tr
              key={`${event.event}-${event.date}-${i}`}
              className="border-b border-border-secondary hover:bg-bg-tertiary transition-colors"
            >
              <td className="py-3 px-3 text-text-primary">{event.date}</td>
              <td className="py-3 px-3 text-text-primary font-medium">{event.event}</td>
              <td className="py-3 px-3 text-text-secondary">{event.country}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.previous ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.forecast ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.actual ?? "—"}</td>
              <td className="py-3 px-3 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_STYLES[event.impact] ?? IMPACT_STYLES.Low}`}>
                  {event.impact}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/calendar/IpoTable.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { IpoEvent } from "@/types";
import { Briefcase } from "lucide-react";

interface IpoTableProps {
  data: IpoEvent[];
}

type SortKey = "date" | "symbol" | "company" | "exchange";

export function IpoTable({ data }: IpoTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary text-text-tertiary">
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("date")}>Expected Date{sortIndicator("date")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("company")}>Company{sortIndicator("company")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("exchange")}>Exchange{sortIndicator("exchange")}</th>
            <th className="text-right py-3 px-3 font-medium">Price Range</th>
            <th className="text-right py-3 px-3 font-medium">Shares</th>
            <th className="text-right py-3 px-3 font-medium">Market Cap</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((event, i) => (
            <tr
              key={`${event.symbol}-${event.date}-${i}`}
              className={`border-b border-border-secondary hover:bg-bg-tertiary transition-colors ${
                event.isPortfolioStock ? "bg-bg-elevated border-l-2 border-l-green-primary" : ""
              }`}
            >
              <td className="py-3 px-3 text-text-primary">{event.date}</td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  {event.isPortfolioStock && <Briefcase className="h-3.5 w-3.5 text-green-primary" />}
                  <div>
                    <span className="text-text-primary font-medium">{event.company || event.symbol}</span>
                    {event.symbol && <span className="text-text-tertiary text-xs ml-2">{event.symbol}</span>}
                  </div>
                </div>
              </td>
              <td className="py-3 px-3 text-text-secondary">{event.exchange || "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.priceRange ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">
                {event.sharesOffered ? `${(event.sharesOffered / 1e6).toFixed(1)}M` : "—"}
              </td>
              <td className="py-3 px-3 text-right text-text-secondary">
                {event.marketCap ? `$${(event.marketCap / 1e9).toFixed(2)}B` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Commit all table components**

```bash
git add src/components/calendar/EarningsTable.tsx src/components/calendar/DividendTable.tsx src/components/calendar/EconomicTable.tsx src/components/calendar/IpoTable.tsx
git commit -m "feat(calendar): add sortable table components for all calendar types"
```

---

### Task 10: Create CalendarTableView component

**Files:**
- Create: `src/components/calendar/CalendarTableView.tsx`

- [ ] **Step 1: Create `src/components/calendar/CalendarTableView.tsx`**

```typescript
"use client";

import type { CalendarType, CalendarEvent, EarningsEvent, DividendEvent, EconomicEvent, IpoEvent } from "@/types";
import { EarningsTable } from "./EarningsTable";
import { DividendTable } from "./DividendTable";
import { EconomicTable } from "./EconomicTable";
import { IpoTable } from "./IpoTable";
import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarTableViewProps {
  type: CalendarType;
  data: CalendarEvent[];
  loading: boolean;
}

const TYPE_LABELS: Record<CalendarType, string> = {
  earnings: "earnings",
  dividends: "dividend",
  economic: "economic",
  ipo: "IPO",
};

export function CalendarTableView({ type, data, loading }: CalendarTableViewProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
        <CalendarDays className="h-12 w-12 mb-3" />
        <p className="text-sm">No {TYPE_LABELS[type]} events in this date range</p>
      </div>
    );
  }

  switch (type) {
    case "earnings":
      return <EarningsTable data={data as EarningsEvent[]} />;
    case "dividends":
      return <DividendTable data={data as DividendEvent[]} />;
    case "economic":
      return <EconomicTable data={data as EconomicEvent[]} />;
    case "ipo":
      return <IpoTable data={data as IpoEvent[]} />;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/CalendarTableView.tsx
git commit -m "feat(calendar): add CalendarTableView with loading and empty states"
```

---

### Task 11: Create CalendarGridView component

**Files:**
- Create: `src/components/calendar/CalendarGridView.tsx`

- [ ] **Step 1: Create `src/components/calendar/CalendarGridView.tsx`**

```typescript
"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarType, CalendarEvent } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarGridViewProps {
  type: CalendarType;
  data: CalendarEvent[];
  loading: boolean;
}

const DOT_COLORS: Record<CalendarType, string> = {
  earnings: "bg-green-primary",
  dividends: "bg-blue-500",
  economic: "bg-orange-500",
  ipo: "bg-purple-500",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function CalendarGridView({ type, data, loading }: CalendarGridViewProps) {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of data) {
      const dateKey = event.date.split("T")[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    }
    return map;
  }, [data]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayKey = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(null);
  }

  if (loading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-text-primary font-medium">{formatMonthYear(currentYear, currentMonth)}</h3>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="text-center text-xs text-text-tertiary font-medium py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before the 1st */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-20" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = formatDateKey(currentYear, currentMonth, day);
          const events = eventsByDate[dateKey] ?? [];
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDay;
          const maxDots = 3;
          const extraCount = events.length - maxDots;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(isSelected ? null : dateKey)}
              className={`h-20 rounded-lg p-1.5 text-left transition-colors border ${
                isSelected
                  ? "border-green-primary bg-bg-elevated"
                  : isToday
                  ? "border-green-primary/50 bg-bg-tertiary"
                  : "border-transparent hover:bg-bg-tertiary"
              }`}
            >
              <span className={`text-xs font-medium ${isToday ? "text-green-primary" : "text-text-secondary"}`}>
                {day}
              </span>
              <div className="flex flex-wrap gap-0.5 mt-1">
                {events.slice(0, maxDots).map((_, j) => (
                  <span key={j} className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[type]}`} />
                ))}
                {extraCount > 0 && (
                  <span className="text-[10px] text-text-tertiary">+{extraCount}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
        <div className="mt-4 p-4 bg-bg-secondary rounded-xl border border-border-primary">
          <h4 className="text-sm font-medium text-text-primary mb-3">
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h4>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-text-tertiary">No events on this day</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-border-secondary last:border-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[type]}`} />
                  <span className="text-text-primary">
                    {"symbol" in event ? event.symbol : ""}
                    {"event" in event ? event.event : ""}
                  </span>
                  <span className="text-text-tertiary ml-auto">
                    {"company" in event && event.company ? event.company : ""}
                    {"country" in event ? event.country : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/CalendarGridView.tsx
git commit -m "feat(calendar): add CalendarGridView with month navigation and day detail panel"
```

---

### Task 12: Create the calendar page

**Files:**
- Create: `src/app/calendar/page.tsx`

- [ ] **Step 1: Create `src/app/calendar/page.tsx`**

This is the main page component that ties everything together. Uses the same layout pattern as the radar page:

```typescript
"use client";

import { useState, useMemo, useCallback } from "react";
import type { CalendarType } from "@/types";
import { useCalendar } from "@/hooks/useCalendar";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { CalendarHeader, type ViewMode, type DatePreset } from "@/components/calendar/CalendarHeader";
import { CalendarTableView } from "@/components/calendar/CalendarTableView";
import { CalendarGridView } from "@/components/calendar/CalendarGridView";

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  switch (preset) {
    case "this-week": {
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: formatDate(start), to: formatDate(end) };
    }
    case "this-month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: formatDate(start), to: formatDate(end) };
    }
    case "next-month": {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return { from: formatDate(start), to: formatDate(end) };
    }
  }
}

export default function CalendarPage() {
  const [calendarType, setCalendarType] = useState<CalendarType>("earnings");
  const [view, setView] = useState<ViewMode>("table");
  const [datePreset, setDatePreset] = useState<DatePreset>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const presetRange = useMemo(() => getDateRange(datePreset), [datePreset]);
  const from = customFrom || presetRange.from;
  const to = customTo || presetRange.to;

  const { data, loading, error } = useCalendar(calendarType, from, to);

  const handleDatePresetChange = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    setCustomFrom("");
    setCustomTo("");
  }, []);

  // Count events per type for sidebar badges
  const counts = useMemo(() => ({
    earnings: calendarType === "earnings" ? data.length : 0,
    dividends: calendarType === "dividends" ? data.length : 0,
    economic: calendarType === "economic" ? data.length : 0,
    ipo: calendarType === "ipo" ? data.length : 0,
  }), [calendarType, data.length]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">Calendar</h1>
        <p className="text-sm text-text-secondary mt-1">
          Track earnings, dividends, economic events, and IPOs
        </p>
      </div>

      {/* Mobile sidebar (horizontal tabs) */}
      <div className="md:hidden">
        <CalendarSidebar selected={calendarType} onSelect={setCalendarType} counts={counts} />
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <CalendarSidebar selected={calendarType} onSelect={setCalendarType} counts={counts} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <CalendarHeader
            view={view}
            onViewChange={setView}
            datePreset={datePreset}
            onDatePresetChange={handleDatePresetChange}
            from={from}
            to={to}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
          />

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-muted text-red-primary text-sm">
              {error}
            </div>
          )}

          {view === "table" ? (
            <CalendarTableView type={calendarType} data={data} loading={loading} />
          ) : (
            <CalendarGridView type={calendarType} data={data} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/calendar/page.tsx
git commit -m "feat(calendar): add calendar page with sidebar, table/grid views"
```

---

## Chunk 3: Integration & Verification

### Task 13: Add FMP_API_KEY to environment

**Files:**
- Modify: `.env` (add `FMP_API_KEY`)

- [ ] **Step 1: Add `FMP_API_KEY` to `.env`**

Add to the end of `.env`:

```
FMP_API_KEY=your_fmp_api_key_here
```

The user needs to get a free API key from https://financialmodelingprep.com/developer/docs/ and replace the placeholder.

- [ ] **Step 2: Commit (do NOT commit the actual key)**

If `.env` is in `.gitignore` (it should be), no commit needed. If there's a `.env.example`, add:

```bash
echo "FMP_API_KEY=" >> .env.example
git add .env.example
git commit -m "feat(calendar): add FMP_API_KEY to env example"
```

---

### Task 14: Verify the build

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: No TypeScript errors. All pages compile successfully.

- [ ] **Step 2: Start dev server and test manually**

```bash
npm run dev
```

Test checklist:
1. Navigate to `/calendar` — page loads with earnings selected by default
2. Click each sidebar item — data updates for each calendar type
3. Toggle between table and grid views
4. Test date presets (This Week, This Month, Next Month)
5. Verify portfolio stocks show green highlight in table rows
6. Verify calendar grid shows colored dots on event days
7. Click a day in grid view — detail panel shows events
8. Check mobile view — sidebar becomes horizontal tabs
9. Verify "Calendar" link appears in navbar and shows active state

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(calendar): complete calendar page with all views and FMP integration"
```
