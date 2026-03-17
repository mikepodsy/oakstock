# Radar Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stock discovery page that displays curated stocks organized by 11 GICS sectors, with expandable card details and quick-add to watchlist.

**Architecture:** Curated ticker lists per sector in a constants file, with live quote data fetched via the existing `useQuotes` hook. Shared components (`CompanyLogo`, `PerformancePills`) extracted from `WatchlistCard` for reuse. Radar page follows the same patterns as the watchlist page (local state for UI, Zustand for watchlist integration).

**Tech Stack:** Next.js 14 App Router, React, Zustand, Tailwind CSS, yahoo-finance2, sonner (toasts)

**Spec:** `docs/superpowers/specs/2026-03-17-radar-page-design.md`

---

## Chunk 1: Shared Components & Data

### Task 1: Add RADAR_SECTORS constant

**Files:**
- Modify: `src/utils/constants.ts`

- [ ] **Step 1: Add the RADAR_SECTORS constant**

Add to the end of `src/utils/constants.ts`:

```typescript
export const RADAR_SECTORS: Record<string, { label: string; tickers: string[] }> = {
  energy: {
    label: "Energy",
    tickers: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HAL", "DVN", "FANG", "BKR"],
  },
  information_technology: {
    label: "Information Technology",
    tickers: ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "AMD", "ADBE", "CSCO", "INTC", "QCOM", "TXN", "AMAT"],
  },
  financials: {
    label: "Financials",
    tickers: ["JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "BLK", "SCHW", "AXP", "C", "SPGI", "CB"],
  },
  health_care: {
    label: "Health Care",
    tickers: ["UNH", "JNJ", "LLY", "PFE", "ABBV", "MRK", "TMO", "ABT", "DHR", "BMY", "AMGN", "MDT", "ISRG"],
  },
  consumer_discretionary: {
    label: "Consumer Discretionary",
    tickers: ["AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "TJX", "BKNG", "CMG", "ORLY", "MAR", "ROST"],
  },
  consumer_staples: {
    label: "Consumer Staples",
    tickers: ["PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "CL", "MDLZ", "GIS", "KHC", "SYY", "HSY"],
  },
  industrials: {
    label: "Industrials",
    tickers: ["CAT", "UNP", "HON", "UPS", "DE", "BA", "RTX", "LMT", "GE", "MMM", "WM", "EMR", "FDX"],
  },
  materials: {
    label: "Materials",
    tickers: ["LIN", "APD", "SHW", "ECL", "FCX", "NEM", "NUE", "DOW", "DD", "VMC", "MLM", "PPG", "CE"],
  },
  utilities: {
    label: "Utilities",
    tickers: ["NEE", "SO", "DUK", "D", "AEP", "SRE", "EXC", "XEL", "ED", "WEC", "ES", "AWK", "PEG"],
  },
  real_estate: {
    label: "Real Estate",
    tickers: ["PLD", "AMT", "CCI", "EQIX", "PSA", "O", "SPG", "WELL", "DLR", "AVB", "EQR", "VTR", "ARE"],
  },
  communication_services: {
    label: "Communication Services",
    tickers: ["META", "GOOG", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "EA", "WBD", "OMC", "TTWO"],
  },
} as const;

export const RADAR_SECTOR_KEYS = Object.keys(RADAR_SECTORS);
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/constants.ts
git commit -m "feat(radar): add curated sector ticker lists"
```

---

### Task 2: Extract CompanyLogo to shared component

**Files:**
- Create: `src/components/shared/CompanyLogo.tsx`
- Modify: `src/components/watchlist/WatchlistCard.tsx`

- [ ] **Step 1: Create the shared CompanyLogo component**

Create `src/components/shared/CompanyLogo.tsx` with the `CompanyLogo` component extracted from `WatchlistCard.tsx`. Include the `LOGO_COLORS` array and `getLogoColor` helper:

```tsx
"use client";

import { useState } from "react";

const LOGO_COLORS = [
  "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

function getLogoColor(ticker: string): string {
  const hash = ticker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return LOGO_COLORS[hash % LOGO_COLORS.length];
}

export function CompanyLogo({
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
```

- [ ] **Step 2: Update WatchlistCard to import from shared**

In `src/components/watchlist/WatchlistCard.tsx`:
- Remove the `LOGO_COLORS` array (starts with `const LOGO_COLORS = [`), the `getLogoColor` function, and the `CompanyLogo` component — everything between the imports and the `PERF_PERIODS` constant
- Add import: `import { CompanyLogo } from "@/components/shared/CompanyLogo";`

- [ ] **Step 3: Verify no TypeScript errors and app renders**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/CompanyLogo.tsx src/components/watchlist/WatchlistCard.tsx
git commit -m "refactor: extract CompanyLogo to shared component"
```

---

### Task 3: Extract PerformancePills to shared component

**Files:**
- Create: `src/components/shared/PerformancePills.tsx`
- Modify: `src/components/watchlist/WatchlistCard.tsx`

- [ ] **Step 1: Create the shared PerformancePills component**

Create `src/components/shared/PerformancePills.tsx` with the `PerformancePills` component extracted from `WatchlistCard.tsx`. Include the `PERF_PERIODS` constant:

```tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { usePerformanceReturns } from "@/hooks/usePerformanceReturns";
import type { PerformancePeriod } from "@/types";

const PERF_PERIODS: PerformancePeriod[] = ["1M", "3M", "YTD", "1Y", "3Y", "5Y"];

export function PerformancePills({
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
```

- [ ] **Step 2: Update WatchlistCard to import from shared**

In `src/components/watchlist/WatchlistCard.tsx`:
- Remove the `PERF_PERIODS` constant (starts with `const PERF_PERIODS`) and the entire `PerformancePills` function component that follows it
- Remove the now-unused imports: `usePerformanceReturns`, `PerformancePeriod`, `Skeleton`
- Add import: `import { PerformancePills } from "@/components/shared/PerformancePills";`

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/PerformancePills.tsx src/components/watchlist/WatchlistCard.tsx
git commit -m "refactor: extract PerformancePills to shared component"
```

---

## Chunk 2: Radar Components

### Task 4: Create RadarCard component

**Files:**
- Create: `src/components/radar/RadarCard.tsx`

The RadarCard mirrors `WatchlistCard` but replaces the "Edit target price & notes" button with an "Add to Watchlist" dropdown. It receives a ticker string and QuoteData directly (no WatchlistItem).

- [ ] **Step 1: Create RadarCard**

Create `src/components/radar/RadarCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { PerformancePills } from "@/components/shared/PerformancePills";
import { WatchlistCardDetail } from "@/components/watchlist/WatchlistCardDetail";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { formatCurrency, formatPercent, formatCompactNumber } from "@/utils/formatters";
import { toast } from "sonner";
import type { QuoteData } from "@/types";

interface RadarCardProps {
  ticker: string;
  name: string;
  quote?: QuoteData;
  isExpanded: boolean;
  onToggle: () => void;
}

export function RadarCard({
  ticker,
  name,
  quote,
  isExpanded,
  onToggle,
}: RadarCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const watchlists = useWatchlistStore((s) => s.watchlists);
  const addItem = useWatchlistStore((s) => s.addItem);

  function handleAddToWatchlist(watchlistId: string) {
    const watchlist = watchlists.find((w) => w.id === watchlistId);
    if (!watchlist) return;

    if (watchlist.items.find((i) => i.ticker === ticker)) {
      toast.error(`${ticker} is already in "${watchlist.name}"`);
      return;
    }

    addItem(watchlistId, { ticker, name });
    toast.success(`Added ${ticker} to "${watchlist.name}"`);
  }

  return (
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
          <CompanyLogo ticker={ticker} website={quote?.website} />
          <div className="flex-1 min-w-0">
            <h3 className="font-financial text-lg text-text-primary">
              {ticker}
            </h3>
            <p className="text-xs text-text-tertiary truncate">{name}</p>
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
            <PerformancePills ticker={ticker} currentPrice={quote.currentPrice} />
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
            <WatchlistCardDetail ticker={ticker} currentPrice={quote.currentPrice} />
          </div>
        )}
      </div>

      {/* Add to Watchlist button */}
      <div className="px-5 pb-4 pt-1 border-t border-border-primary">
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger
            render={
              <button
                className="flex items-center gap-1 text-xs text-green-primary hover:text-green-primary/80 transition-colors mx-auto"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add to Watchlist
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" sideOffset={4}>
            {watchlists.length === 0 ? (
              <DropdownMenuLabel>No watchlists created</DropdownMenuLabel>
            ) : (
              <>
                <DropdownMenuLabel>Add to...</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {watchlists.map((w) => (
                  <DropdownMenuItem
                    key={w.id}
                    onClick={() => handleAddToWatchlist(w.id)}
                  >
                    {w.name}
                    <span className="ml-auto text-xs text-text-tertiary">
                      {w.items.length}
                    </span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/radar/RadarCard.tsx
git commit -m "feat(radar): add RadarCard component with watchlist integration"
```

---

### Task 5: Create RadarGrid component

**Files:**
- Create: `src/components/radar/RadarGrid.tsx`

- [ ] **Step 1: Create RadarGrid**

Create `src/components/radar/RadarGrid.tsx`:

```tsx
"use client";

import { RadarCard } from "./RadarCard";
import type { QuoteData } from "@/types";

interface RadarGridProps {
  tickers: { ticker: string; name: string }[];
  quotes: Record<string, QuoteData>;
  expandedTicker: string | null;
  onToggleExpand: (ticker: string) => void;
}

export function RadarGrid({
  tickers,
  quotes,
  expandedTicker,
  onToggleExpand,
}: RadarGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tickers.map(({ ticker, name }) => (
        <RadarCard
          key={ticker}
          ticker={ticker}
          name={name}
          quote={quotes[ticker]}
          isExpanded={expandedTicker === ticker}
          onToggle={() => onToggleExpand(ticker)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/radar/RadarGrid.tsx
git commit -m "feat(radar): add RadarGrid component"
```

---

## Chunk 3: Radar Page & Navigation

### Task 6: Create the Radar page

**Files:**
- Create: `src/app/radar/page.tsx`

- [ ] **Step 1: Create the radar page**

Create `src/app/radar/page.tsx`:

```tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuotes } from "@/hooks/useQuotes";
import { RadarGrid } from "@/components/radar/RadarGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { RADAR_SECTORS, RADAR_SECTOR_KEYS } from "@/utils/constants";

export default function RadarPage() {
  const [selectedSector, setSelectedSector] = useState(RADAR_SECTOR_KEYS[0]);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const sector = RADAR_SECTORS[selectedSector];
  const tickers = useMemo(() => sector.tickers, [sector]);
  const { quotes, loading } = useQuotes(tickers);

  // Collapse expanded card when switching sectors
  useEffect(() => {
    setExpandedTicker(null);
  }, [selectedSector]);

  // Build ticker+name pairs (name comes from quote data or falls back to ticker)
  const tickerItems = useMemo(
    () =>
      tickers.map((t) => ({
        ticker: t,
        name: quotes[t]?.name ?? t,
      })),
    [tickers, quotes]
  );

  function handleToggleExpand(ticker: string) {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">Radar</h1>
        <p className="text-sm text-text-secondary mt-1">
          Discover stocks by sector
        </p>
      </div>

      {/* Sector Filter Banner */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b border-border-primary">
        {RADAR_SECTOR_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setSelectedSector(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              key === selectedSector
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            {RADAR_SECTORS[key].label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && Object.keys(quotes).length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <RadarGrid
          tickers={tickerItems}
          quotes={quotes}
          expandedTicker={expandedTicker}
          onToggleExpand={handleToggleExpand}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/radar/page.tsx
git commit -m "feat(radar): add radar page with sector filtering"
```

---

### Task 7: Add Radar to navigation

**Files:**
- Modify: `src/components/layout/Navbar.tsx`

- [ ] **Step 1: Add Radar link to NAV_LINKS**

In `src/components/layout/Navbar.tsx`, add the Radar entry to the `NAV_LINKS` array (line 18, before the closing bracket):

```typescript
const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/radar", label: "Radar" },
  { href: "/rebalance", label: "Rebalance" },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Navbar.tsx
git commit -m "feat(radar): add Radar to navigation"
```

---

### Task 8: Manual verification

- [ ] **Step 1: Start dev server and verify**

Run: `npm run dev`

Verify in browser:
1. Navigate to `/radar` — page loads with Energy selected by default
2. Click through each of the 11 sector pills — cards update to show that sector's stocks
3. Cards show live prices, day change, and performance pills
4. Click a card — accordion expands with chart and financials
5. Click "+ Add to Watchlist" — dropdown shows user's watchlists
6. Add a stock — verify it appears in the watchlist page
7. Try adding a duplicate — verify toast says "already in"
8. Check mobile responsive: pills scroll horizontally, cards stack to 1 column
9. Verify the watchlist page still works correctly (shared components didn't break anything)
10. Verify Radar link appears in navbar and highlights when active

- [ ] **Step 2: Fix and commit if any issues found**

If fixes are needed, commit with a specific message describing what was fixed (e.g., `fix(radar): correct dropdown alignment on mobile`).
