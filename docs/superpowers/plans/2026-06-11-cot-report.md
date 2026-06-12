# COT Report Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/cot` dashboard page displaying CFTC Commitment of Traders data for S&P 500, Nasdaq 100, Gold, and Crude Oil — showing long/short positioning and net position by trader category with week-over-week deltas.

**Architecture:** API route fans out to two CFTC public endpoints (TFF for financial futures, Disaggregated for commodities), merges into a unified `CotReport[]` shape cached 24h via `TTLCache`, served to a client page via the existing service → hook pattern.

**Tech Stack:** Next.js 14 App Router, Recharts 3, Tailwind CSS, lucide-react, TypeScript. No test framework — manual verification via curl and browser.

**Spec:** `docs/superpowers/specs/2026-06-11-cot-report-design.md`

---

## Chunk 1: Data Layer (Types, Cache, API Route)

### Task 1: Add types to `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts` (append to end)

- [ ] **Step 1: Append COT types**

Open `src/types/index.ts` and append at the end:

```ts
// ─── COT Report ───────────────────────────────────────
export type CotReportType = "tff" | "disagg";

export interface CotInstrument {
  label: string;
  cftcName: string;
  reportType: CotReportType;
}

export interface CotCategory {
  name: string;
  longs: number;
  shorts: number;
  net: number;
  netChange: number;
}

export interface CotReport {
  instrument: string;
  reportDate: string;
  reportType: CotReportType;
  categories: CotCategory[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to the new types.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(cot): add COT types to index.ts"
```

---

### Task 2: Add `cotCache` to `src/lib/cache.ts`

**Files:**
- Modify: `src/lib/cache.ts` (append one line)

- [ ] **Step 1: Add the cache export**

Open `src/lib/cache.ts` and append at the end (after `treasuryCache`):

```ts
export const cotCache = getOrCreateCache<unknown[]>("cot", 86400);
```

The `unknown[]` type is intentional here — the cache stores the raw `CotReport[]` but we keep the cache module free of domain type imports. The route will cast on read.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/cache.ts
git commit -m "feat(cot): add cotCache (86400s TTL)"
```

---

### Task 3: Build the API route `src/app/api/cot/route.ts`

**Files:**
- Create: `src/app/api/cot/route.ts`

**Before starting — verify CFTC field names:**

The CFTC public portal uses the OpenDataSoft v2.1 API. Before writing the route, run these two curl commands to confirm field names match the spec. If any column name differs, update the `COLUMN_MAP` constants in the route accordingly.

```bash
# Check TFF (financial futures) — S&P 500 record
curl -s "https://publicreporting.cftc.gov/api/explore/v2.1/catalog/datasets/fin_fut/records?where=market_and_exchange_names%3D%22S%26P+500+STOCK+INDEX+-+CHICAGO+MERCANTILE+EXCHANGE%22&limit=1&order_by=report_date_as_of+desc" | python3 -m json.tool | head -80
```

```bash
# Check Disaggregated — Gold record
curl -s "https://publicreporting.cftc.gov/api/explore/v2.1/catalog/datasets/com_disagg/records?where=market_and_exchange_names%3D%22GOLD+-+COMMODITY+EXCHANGE+INC.%22&limit=1&order_by=report_date_as_of+desc" | python3 -m json.tool | head -80
```

Confirm these fields exist in the TFF response:
- `asset_mgr_positions_long`, `asset_mgr_positions_short`
- `lev_money_positions_long`, `lev_money_positions_short`
- `dealer_positions_long_all`, `dealer_positions_short_all`
- `other_rept_positions_long`, `other_rept_positions_short`
- `nonrept_positions_long_all`, `nonrept_positions_short_all`
- `report_date_as_of`

Confirm these fields exist in the Disaggregated response:
- `swap_positions_long_all`, `swap_positions_short_all`
- `m_money_positions_long`, `m_money_positions_short`
- `prod_merc_positions_long_all`, `prod_merc_positions_short_all`
- `other_rept_positions_long`, `other_rept_positions_short`
- `nonrept_positions_long_all`, `nonrept_positions_short_all`
- `report_date_as_of`

Also confirm `market_and_exchange_names` is the correct filter field name.

If any names differ, adjust the constants in the route below before implementing.

- [ ] **Step 4: Create the route file**

```ts
import { NextResponse } from "next/server";
import { cotCache } from "@/lib/cache";
import type { CotReport, CotCategory, CotInstrument, CotReportType } from "@/types";

// ─── Instrument Config (add more here to extend) ──────────────────────────────
const INSTRUMENTS: CotInstrument[] = [
  {
    label: "S&P 500",
    cftcName: "S&P 500 STOCK INDEX - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
  },
  {
    label: "Nasdaq 100",
    cftcName: "NASDAQ-100 STOCK INDEX - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
  },
  {
    label: "Gold",
    cftcName: "GOLD - COMMODITY EXCHANGE INC.",
    reportType: "disagg",
  },
  {
    label: "Crude Oil WTI",
    cftcName: "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE",
    reportType: "disagg",
  },
];

// ─── CFTC Column Maps ─────────────────────────────────────────────────────────
type ColPair = { long: string; short: string };

const TFF_CATEGORIES: { name: string; cols: ColPair }[] = [
  { name: "Asset Manager / Institutional", cols: { long: "asset_mgr_positions_long", short: "asset_mgr_positions_short" } },
  { name: "Leveraged Funds",               cols: { long: "lev_money_positions_long", short: "lev_money_positions_short" } },
  { name: "Dealer / Intermediary",         cols: { long: "dealer_positions_long_all", short: "dealer_positions_short_all" } },
  { name: "Other Reportables",             cols: { long: "other_rept_positions_long", short: "other_rept_positions_short" } },
  { name: "Retail / Non-Reportable",       cols: { long: "nonrept_positions_long_all", short: "nonrept_positions_short_all" } },
];

const DISAGG_CATEGORIES: { name: string; cols: ColPair }[] = [
  { name: "Swap Dealers",        cols: { long: "swap_positions_long_all",      short: "swap_positions_short_all" } },
  { name: "Managed Money",       cols: { long: "m_money_positions_long",       short: "m_money_positions_short" } },
  { name: "Producer / Merchant", cols: { long: "prod_merc_positions_long_all", short: "prod_merc_positions_short_all" } },
  { name: "Other Reportables",   cols: { long: "other_rept_positions_long",    short: "other_rept_positions_short" } },
  { name: "Retail / Non-Reportable", cols: { long: "nonrept_positions_long_all", short: "nonrept_positions_short_all" } },
];

const DATASET: Record<CotReportType, string> = {
  tff:    "fin_fut",
  disagg: "com_disagg",
};

const CFTC_BASE = "https://publicreporting.cftc.gov/api/explore/v2.1/catalog/datasets";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function num(record: Record<string, unknown>, col: string): number {
  const v = record[col];
  return typeof v === "number" ? v : Number(v ?? 0);
}

function buildCategories(
  latest: Record<string, unknown>,
  prev: Record<string, unknown> | null,
  categoryDefs: { name: string; cols: ColPair }[]
): CotCategory[] {
  return categoryDefs.map(({ name, cols }) => {
    const longs  = num(latest, cols.long);
    const shorts = num(latest, cols.short);
    const net    = longs - shorts;
    const prevNet = prev ? num(prev, cols.long) - num(prev, cols.short) : 0;
    return { name, longs, shorts, net, netChange: net - prevNet };
  });
}

async function fetchInstrument(instrument: CotInstrument): Promise<CotReport | null> {
  const dataset = DATASET[instrument.reportType];
  const categoryDefs = instrument.reportType === "tff" ? TFF_CATEGORIES : DISAGG_CATEGORIES;
  const whereValue = encodeURIComponent(`"${instrument.cftcName}"`);
  const url = `${CFTC_BASE}/${dataset}/records?where=market_and_exchange_names%3D${whereValue}&limit=2&order_by=report_date_as_of+desc`;

  const res = await fetch(url, { next: { revalidate: 0 } }); // cache handled by TTLCache
  if (!res.ok) {
    console.error(`[COT] CFTC fetch failed for ${instrument.label}: ${res.status}`);
    return null;
  }

  const json = await res.json() as { results?: Record<string, unknown>[] };
  const results = json.results ?? [];
  if (results.length === 0) {
    console.error(`[COT] No records found for ${instrument.label}`);
    return null;
  }

  const latest = results[0];
  const prev   = results[1] ?? null;

  return {
    instrument: instrument.label,
    reportDate: String(latest.report_date_as_of ?? ""),
    reportType: instrument.reportType,
    categories: buildCategories(latest, prev, categoryDefs),
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET() {
  const CACHE_KEY = "cot-all";
  const cached = cotCache.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const results = await Promise.allSettled(INSTRUMENTS.map(fetchInstrument));
  const reports: CotReport[] = results
    .filter((r): r is PromiseFulfilledResult<CotReport> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);

  cotCache.set(CACHE_KEY, reports as unknown[]);
  return NextResponse.json(reports, { headers: CACHE_HEADERS });
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Start dev server and hit the route**

```bash
npm run dev
```

In a separate terminal:

```bash
curl -s http://localhost:3000/api/cot | python3 -m json.tool
```

Expected: A JSON array of 4 objects, each with `instrument`, `reportDate`, `reportType`, `categories` (array of 5 objects each with `name`, `longs`, `shorts`, `net`, `netChange`). Numbers should be non-zero integers in the hundreds of thousands.

If you get `[]` or errors, check:
1. The CFTC field names match — compare curl output from the pre-step against the column maps
2. The `where` filter URL encoding — try the CFTC URL directly in the browser
3. Network access from your dev environment to `publicreporting.cftc.gov`

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cot/route.ts
git commit -m "feat(cot): add CFTC API route with dual-endpoint fetch and 24h cache"
```

---

## Chunk 2: Client Layer (Service + Hook)

### Task 4: Create `src/services/cotService.ts`

**Files:**
- Create: `src/services/cotService.ts`

- [ ] **Step 1: Create the service**

```ts
import type { CotReport } from "@/types";

export async function fetchCotData(): Promise<CotReport[]> {
  const res = await fetch("/api/cot");
  if (!res.ok) throw new Error(`COT fetch failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/services/cotService.ts
git commit -m "feat(cot): add cotService"
```

---

### Task 5: Create `src/hooks/useCotData.ts`

**Files:**
- Create: `src/hooks/useCotData.ts`

- [ ] **Step 1: Create the hook**

```ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { CotReport } from "@/types";
import { fetchCotData } from "@/services/cotService";

export function useCotData() {
  const [data, setData]       = useState<CotReport[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCotData();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch COT data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
```

Note: No `setInterval` — COT data is weekly. The 24h server cache makes client polling unnecessary.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCotData.ts
git commit -m "feat(cot): add useCotData hook"
```

---

## Chunk 3: Components

### Task 6: Create `src/components/cot/CotLoadingSkeleton.tsx`

**Files:**
- Create: `src/components/cot/CotLoadingSkeleton.tsx`

- [ ] **Step 1: Create skeleton component**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function CotLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Instrument tab skeletons */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      {/* Long/Short chart card */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </div>
      {/* Net position chart card */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cot/CotLoadingSkeleton.tsx
git commit -m "feat(cot): add CotLoadingSkeleton"
```

---

### Task 7: Create `src/components/cot/CotInstrumentTabs.tsx`

**Files:**
- Create: `src/components/cot/CotInstrumentTabs.tsx`

- [ ] **Step 1: Create the tabs component**

```tsx
import type { CotReport } from "@/types";

interface CotInstrumentTabsProps {
  reports: CotReport[];
  selected: string;
  onSelect: (instrument: string) => void;
}

export function CotInstrumentTabs({ reports, selected, onSelect }: CotInstrumentTabsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {reports.map((r) => (
        <button
          key={r.instrument}
          onClick={() => onSelect(r.instrument)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selected === r.instrument
              ? "bg-green-muted text-green-primary"
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          }`}
        >
          {r.instrument}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cot/CotInstrumentTabs.tsx
git commit -m "feat(cot): add CotInstrumentTabs"
```

---

### Task 8: Create `src/components/cot/CotPositionChart.tsx`

This is the horizontal grouped bar chart showing longs (green) and shorts (red) side by side per trader category.

**Files:**
- Create: `src/components/cot/CotPositionChart.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { CotCategory } from "@/types";

function formatContracts(v: number): string {
  return new Intl.NumberFormat("en-US").format(Math.abs(v));
}

function formatCompact(v: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

interface CotPositionChartProps {
  categories: CotCategory[];
  title: string;
}

const tooltipStyle = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border-primary)",
  borderRadius: 8,
  fontSize: 12,
};

export function CotPositionChart({ categories, title }: CotPositionChartProps) {
  const data = categories.map((c) => ({
    name: c.name,
    Longs: c.longs,
    Shorts: c.shorts,
  }));

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-primary mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 4 }}
          barSize={9}
          barGap={2}
        >
          <CartesianGrid horizontal={false} stroke="var(--border-primary)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={formatCompact}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [formatContracts(Number(v)), String(name)]}
            cursor={{ fill: "var(--bg-tertiary)", opacity: 0.4 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => (
              <span style={{ color: "var(--text-secondary)" }}>{value}</span>
            )}
          />
          <Bar dataKey="Longs"  fill="var(--green-primary)" radius={[0, 3, 3, 0]} />
          <Bar dataKey="Shorts" fill="var(--red-primary)"   radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cot/CotPositionChart.tsx
git commit -m "feat(cot): add CotPositionChart (long/short grouped horizontal bars)"
```

---

### Task 9: Create `src/components/cot/CotNetChart.tsx`

Net position chart — single bar per category, green if net long, red if net short. WoW delta shown at bar end.

**Files:**
- Create: `src/components/cot/CotNetChart.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";
import type { CotCategory } from "@/types";

function formatContracts(v: number): string {
  return new Intl.NumberFormat("en-US").format(Math.abs(v));
}

function formatCompact(v: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

function formatDelta(change: number): string {
  if (change === 0) return "—";
  const abs = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(change));
  return change > 0 ? `▲ ${abs}` : `▼ ${abs}`;
}

interface CotNetChartProps {
  categories: CotCategory[];
}

const tooltipStyle = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border-primary)",
  borderRadius: 8,
  fontSize: 12,
};

interface LabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
  index?: number;
}

function DeltaLabel({ x = 0, y = 0, width = 0, height = 0, value = 0, index = 0, categories }: LabelProps & { categories: CotCategory[] }) {
  const cat = categories[index];
  if (!cat) return null;
  const delta = cat.netChange;
  if (delta === 0) return null;

  const isPositive = delta > 0;
  const labelX = value >= 0 ? x + width + 6 : x + width - 6;
  const anchor = value >= 0 ? "start" : "end";

  return (
    <text
      x={labelX}
      y={y + height / 2}
      dy={4}
      textAnchor={anchor}
      fontSize={11}
      fontFamily="monospace"
      fill={isPositive ? "var(--green-primary)" : "var(--red-primary)"}
    >
      {formatDelta(delta)}
    </text>
  );
}

export function CotNetChart({ categories }: CotNetChartProps) {
  const data = categories.map((c) => ({
    name: c.name,
    net: c.net,
  }));

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-primary mb-1">Net Position</h3>
      <p className="text-xs text-text-tertiary mb-4">Longs minus shorts per category. Arrow = week-over-week change.</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 80, bottom: 0, left: 4 }}
          barSize={14}
        >
          <CartesianGrid horizontal={false} stroke="var(--border-primary)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={formatCompact}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => {
              const n = Number(v);
              return [`${n >= 0 ? "+" : ""}${formatContracts(n)} contracts`, "Net"];
            }}
            cursor={{ fill: "var(--bg-tertiary)", opacity: 0.4 }}
          />
          <Bar dataKey="net" radius={[0, 3, 3, 0]}>
            {categories.map((c, i) => (
              <Cell
                key={c.name}
                fill={c.net >= 0 ? "var(--green-primary)" : "var(--red-primary)"}
              />
            ))}
            <LabelList
              dataKey="net"
              content={(props) => (
                <DeltaLabel {...(props as LabelProps)} categories={categories} />
              )}
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
git add src/components/cot/CotNetChart.tsx
git commit -m "feat(cot): add CotNetChart (net position with WoW delta labels)"
```

---

## Chunk 4: Page + Navigation

### Task 10: Create `src/app/cot/page.tsx`

**Files:**
- Create: `src/app/cot/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useState } from "react";
import { useCotData } from "@/hooks/useCotData";
import { CotInstrumentTabs } from "@/components/cot/CotInstrumentTabs";
import { CotPositionChart } from "@/components/cot/CotPositionChart";
import { CotNetChart } from "@/components/cot/CotNetChart";
import { CotLoadingSkeleton } from "@/components/cot/CotLoadingSkeleton";
import { formatDate } from "@/utils/formatters";
import { RefreshCw } from "lucide-react";

export default function CotPage() {
  const { data, loading, error, refetch } = useCotData();
  const [selected, setSelected] = useState<string | null>(null);

  const report = data
    ? (data.find((r) => r.instrument === (selected ?? data[0]?.instrument)) ?? data[0])
    : null;

  const selectedInstrument = report?.instrument ?? selected ?? data?.[0]?.instrument ?? "S&P 500";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">COT Report</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            CFTC Commitment of Traders — positioning by trader category
          </p>
        </div>
        {report && (
          <div className="text-right">
            <span className="text-xs text-text-tertiary">Report date</span>
            <p className="text-sm font-mono text-text-secondary">{formatDate(report.reportDate)}</p>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && <CotLoadingSkeleton />}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 text-center">
          <p className="text-sm text-text-secondary mb-3">{error}</p>
          <button
            onClick={refetch}
            className="flex items-center gap-2 mx-auto px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-primary text-sm hover:bg-bg-elevated transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && data.length > 0 && (
        <div className="space-y-4">
          {/* Instrument tabs */}
          <CotInstrumentTabs
            reports={data}
            selected={selectedInstrument}
            onSelect={setSelected}
          />

          {report && (
            <>
              {/* Long / Short chart */}
              <CotPositionChart
                categories={report.categories}
                title={`${report.instrument} — Long / Short Positioning`}
              />

              {/* Net position chart */}
              <CotNetChart categories={report.categories} />
            </>
          )}
        </div>
      )}

      {/* Empty state (API returned 0 instruments) */}
      {!loading && !error && data && data.length === 0 && (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 text-center">
          <p className="text-sm text-text-secondary">No COT data available. CFTC data may be temporarily unavailable.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Start dev server and open the page**

Navigate to `http://localhost:3000/cot`. Verify:
- Loading skeleton appears briefly
- Four instrument tabs render (S&P 500, Nasdaq 100, Gold, Crude Oil WTI)
- Long/Short chart shows 5 horizontal bar pairs (2 bars per category), green and red
- Net position chart shows 5 horizontal bars, colored by sign
- WoW delta arrows appear at bar ends (▲/▼)
- Report date appears in header
- Switching tabs updates all charts

- [ ] **Step 4: Commit**

```bash
git add src/app/cot/page.tsx
git commit -m "feat(cot): add COT Report page"
```

---

### Task 11: Add COT Report to sidebar navigation

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `BarChart2` to the lucide-react import**

In `src/components/layout/Sidebar.tsx`, find the lucide-react import block and add `BarChart2`:

```ts
import {
  Leaf,
  Menu,
  LayoutDashboard,
  Briefcase,
  Eye,
  Radar,
  CalendarDays,
  HandCoins,
  TrendingUp,
  Calculator,
  Scale,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  BarChart2,      // ← add this
} from "lucide-react";
```

- [ ] **Step 2: Add the nav link after "Economic"**

Find the `NAV_LINKS` array and insert after the Economic entry:

```ts
const NAV_LINKS = [
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/portfolio",  label: "Portfolio",  icon: Briefcase },
  { href: "/watchlist",  label: "Watchlist",  icon: Eye },
  { href: "/radar",      label: "Radar",      icon: Radar },
  { href: "/market-data",label: "Market Data",icon: Globe },
  { href: "/calendar",   label: "Calendar",   icon: CalendarDays },
  { href: "/dividends",  label: "Dividends",  icon: HandCoins },
  { href: "/economic",   label: "Economic",   icon: TrendingUp },
  { href: "/cot",        label: "COT Report", icon: BarChart2 },  // ← add this line
  { href: "/dcf",        label: "DCF",        icon: Calculator },
  { href: "/rebalance",  label: "Rebalance",  icon: Scale },
  { href: "/experts",    label: "Experts",    icon: Users },
];
```

- [ ] **Step 3: Verify TypeScript and lint**

```bash
npx tsc --noEmit && npx eslint src/components/layout/Sidebar.tsx
```

- [ ] **Step 4: Verify in browser**

Navigate to any page. Confirm "COT Report" appears in the sidebar between "Economic" and "DCF". Confirm active state highlights correctly when on `/cot`. Confirm collapsed sidebar shows only the icon.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(cot): add COT Report to sidebar navigation"
```

---

## Final Verification

- [ ] Run a full TypeScript check across the project:

```bash
npx tsc --noEmit
```

- [ ] Run the linter:

```bash
npx eslint src/
```

- [ ] Open `http://localhost:3000/cot` and do a complete end-to-end check:
  - All 4 instruments have data (non-zero bars)
  - Switching instruments works correctly
  - Both charts render without console errors
  - Report date updates per instrument
  - WoW delta arrows are present and directionally sensible
  - Sidebar link is active when on `/cot`
  - Sidebar collapses to icon-only correctly
  - Mobile: nav sheet includes COT Report

- [ ] Commit anything uncommitted:

```bash
git status
```

---

## Known Implementation Notes

1. **CFTC field names** — The column names in the route were taken from the CFTC data dictionary and the spec. Verify them against the live API (Task 3 pre-step) before implementing the route. Common gotcha: the Disaggregated `spread` columns have inconsistent naming in some datasets.

2. **`DeltaLabel` component in `CotNetChart`** — The custom `LabelList` content renderer requires careful typing because Recharts passes unknown props. If TypeScript complains about the `content` prop, cast `props` to `LabelProps` explicitly.

3. **Negative net bars** — Recharts with `layout="vertical"` handles negative values correctly (bars extend left from the zero line). No special handling needed.

4. **Report date format** — CFTC returns dates as `YYYY-MM-DD` strings. `formatDate` from `src/utils/formatters.ts` handles this correctly.
