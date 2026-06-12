# COT Report Dashboard — Design Spec

**Date:** 2026-06-11  
**Status:** Approved  

---

## Overview

A new dashboard page (`/cot`) that displays CFTC Commitment of Traders data for key futures instruments. Shows net positioning by trader category using a Bloomberg terminal-inspired data-dense layout. Intended to help users see who (institutional, hedge funds, dealers, retail) is leaning long or short in major markets.

---

## Architecture

**Approach:** Follow the existing Oakstock pattern — API route → service → custom hook → client page component. Identical structure to the `economic` page.

**Data flow:**
```
CFTC fin_fut API (S&P, Nasdaq)     ──┐
CFTC com_disagg API (Gold, Oil)    ──┤  /api/cot/route.ts  →  cotService.ts  →  useCotData  →  /cot/page.tsx
                                   └─  24h server-side cache (Next.js revalidate: 86400)
```

The API route makes two parallel fetches — one to each CFTC endpoint — then merges results into a unified `CotReport[]` shape. Each CFTC endpoint is queried with `limit=2&order=report_date_as_of_desc` to get the two most recent weeks (required for WoW delta calculation).

**CFTC authentication:** None required. Both endpoints are public with no API key.

---

## File Structure

### New files

| File | Purpose |
|---|---|
| `src/app/api/cot/route.ts` | API route — fetches CFTC, merges, caches 24h |
| `src/app/cot/page.tsx` | COT dashboard page (client component) |
| `src/components/cot/CotInstrumentTabs.tsx` | Instrument selector tabs |
| `src/components/cot/CotPositionChart.tsx` | Horizontal grouped bar: longs + shorts per category |
| `src/components/cot/CotNetChart.tsx` | Net position bar chart (green/red per sign) with WoW delta |
| `src/components/cot/CotLoadingSkeleton.tsx` | Loading skeleton matching chart card heights |
| `src/hooks/useCotData.ts` | Data fetching hook (loading / error / refetch) |
| `src/services/cotService.ts` | Service — wraps fetch to `/api/cot` |

### Modified files

| File | Change |
|---|---|
| `src/components/layout/Sidebar.tsx` | Add "COT Report" nav link after "Economic" |
| `src/types/index.ts` | Add `CotInstrument`, `CotCategory`, `CotReport` types |

---

## Data Model

### Instruments (configurable array at top of `route.ts`)

| Display Name | CFTC Filter String | Report Type |
|---|---|---|
| S&P 500 | `S&P 500 STOCK INDEX - CHICAGO MERCANTILE EXCHANGE` | `tff` |
| Nasdaq 100 | `NASDAQ-100 STOCK INDEX - CHICAGO MERCANTILE EXCHANGE` | `tff` |
| Gold | `GOLD - COMMODITY EXCHANGE INC.` | `disagg` |
| Crude Oil WTI | `CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE` | `disagg` |

### Category labels by report type

| TFF (S&P 500, Nasdaq 100) | Disaggregated (Gold, Crude Oil) |
|---|---|
| Asset Manager / Institutional | Swap Dealers |
| Leveraged Funds | Managed Money |
| Dealer / Intermediary | Producer / Merchant |
| Other Reportables | Other Reportables |
| Retail / Non-Reportable | Retail / Non-Reportable |

### TypeScript types (added to `src/types/index.ts`)

```ts
export type CotReportType = "tff" | "disagg";

export interface CotCategory {
  name: string;       // e.g. "Leveraged Funds"
  longs: number;      // raw contract count
  shorts: number;
  net: number;        // longs - shorts
  netChange: number;  // net this week - net last week
}

export interface CotReport {
  instrument: string;       // "S&P 500"
  reportDate: string;       // "2025-06-03"
  reportType: CotReportType;
  categories: CotCategory[];
}
```

---

## API Route (`/api/cot`)

- **Method:** GET
- **Cache:** `revalidate = 86400` (24 hours, weekly COT data)
- **Response:** `CotReport[]`
- Fans out two parallel fetches to CFTC public endpoints
- Each fetch requests `limit=2` records sorted descending by report date
- First record = latest week, second record = previous week (for `netChange`)
- Maps CFTC column names to `CotCategory` fields based on `reportType`
- Filters each response to exact instrument name match

**CFTC endpoints used:**
- TFF: `https://publicreporting.cftc.gov/api/explore/dataset/fin_fut/exports/json/`
- Disaggregated: `https://publicreporting.cftc.gov/api/explore/dataset/com_disagg/exports/json/`

**TFF column mapping:**
| Category | Longs col | Shorts col |
|---|---|---|
| Asset Manager / Institutional | `asset_mgr_positions_long` | `asset_mgr_positions_short` |
| Leveraged Funds | `lev_money_positions_long` | `lev_money_positions_short` |
| Dealer / Intermediary | `dealer_positions_long_all` | `dealer_positions_short_all` |
| Other Reportables | `other_rept_positions_long` | `other_rept_positions_short` |
| Retail / Non-Reportable | `nonrept_positions_long_all` | `nonrept_positions_short_all` |

**Disaggregated column mapping:**
| Category | Longs col | Shorts col |
|---|---|---|
| Swap Dealers | `swap_positions_long_all` | `swap__positions_short_all` |
| Managed Money | `m_money_positions_long` | `m_money_positions_short` |
| Producer / Merchant | `prod_merc_positions_long_all` | `prod_merc_positions_short_all` |
| Other Reportables | `other_rept_positions_long` | `other_rept_positions_short` |
| Retail / Non-Reportable | `nonrept_positions_long_all` | `nonrept_positions_short_all` |

---

## Service (`cotService.ts`)

Thin wrapper — calls `fetch('/api/cot')` and returns `CotReport[]`. Handles non-OK responses by throwing an error.

---

## Hook (`useCotData.ts`)

Mirrors `useEconomicData.ts` pattern exactly:
- `useState` for `data: CotReport[] | null`, `loading: boolean`, `error: string | null`
- `useCallback` wrapping the fetch
- `useEffect` to call on mount
- Returns `{ data, loading, error, refetch }`
- No auto-refresh interval (COT data is weekly; 24h cache is sufficient)

---

## Page (`/cot/page.tsx`)

Client component. Structure:

```
Page header: "COT Report" title + report date badge (from selected instrument's reportDate)
Instrument tabs: [S&P 500] [Nasdaq 100] [Gold] [Crude Oil WTI]  ← CotInstrumentTabs
  ↓ selected instrument drives which CotReport is displayed
Loading state: CotLoadingSkeleton (two card skeletons)
Error state: error message card + Retry button (calls refetch)
Long / Short chart: CotPositionChart  ← horizontal grouped bars
Net Position chart: CotNetChart       ← single horizontal bar per category, green/red
```

State: `selectedInstrument` (string, defaults to first instrument). The page receives all 4 reports from the hook and filters to the selected one for rendering.

---

## Charts

### CotPositionChart (Long/Short grouped bar)

- Recharts `<BarChart layout="vertical">` 
- Y-axis: category names, width ~180px
- X-axis: contract counts, formatted with comma separators
- Two `<Bar>` elements: longs (`fill="var(--green-primary)"`) and shorts (`fill="var(--red-primary)"`), `barSize={10}`, `barGap={2}`
- Subtle `<CartesianGrid horizontal={false}>`  with `stroke="var(--border-primary)"`
- Custom tooltip: bg `var(--bg-secondary)`, border `var(--border-primary)`, monospace font for numbers
- Height: ~280px in card with `bg-bg-secondary border border-border-primary rounded-xl p-4`
- Legend: small inline green/red dots + "Long" / "Short" labels below chart

### CotNetChart (Net position + WoW delta)

- Same horizontal BarChart layout
- Single `<Bar>` with `<Cell>` per entry — `fill="var(--green-primary)"` if `net > 0`, else `fill="var(--red-primary)"`
- Custom `<LabelList>` at bar end: `▲ 12,340` (green) or `▼ 8,200` (red) for `netChange`, in `font-mono text-xs`; `—` if `netChange === 0`
- Height: ~220px, same card style

### CotLoadingSkeleton

Two stacked skeleton cards matching the above heights. Uses existing `<Skeleton>` component.

---

## Design Tokens

Matches the dark Oakstock theme:

| Purpose | Token |
|---|---|
| Card background | `bg-bg-secondary` |
| Card border | `border-border-primary` |
| Long bars | `var(--green-primary)` = `#22C55E` |
| Short / net-short bars | `var(--red-primary)` = `#EF4444` |
| Category labels | `text-text-secondary` |
| Number values | `text-text-primary font-mono` |
| Delta arrows | green-primary / red-primary |
| Grid lines | `var(--border-primary)` |

---

## Navigation

Add to `NAV_LINKS` in `Sidebar.tsx` after the "Economic" entry:

```ts
{ href: "/cot", label: "COT Report", icon: BarChart2 },
```

Import `BarChart2` from `lucide-react` (already available in the project).

---

## Error Handling

- API route: if CFTC fetch fails for one report type, return a partial result (the other instruments) rather than failing entirely; log the error server-side
- Hook: surface error string to page
- Page: show error card with message and Retry button for full-page error; if partial data available, show available instruments and a warning badge on unavailable ones

---

## Out of Scope (v1)

- Historical net position trend chart (multi-week sparkline)
- Exporting data to CSV
- Alerts / notifications when positioning shifts significantly
- More than 4 instruments in the initial list
