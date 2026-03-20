# Calendar Page Design Spec

## Context

Oakstock currently has no way to surface upcoming financial events. Users need visibility into earnings reports, dividend dates, economic releases, and IPOs — especially for stocks they already hold or watch. This page adds a centralized calendar with real data from FMP (Financial Modeling Prep) API.

## Overview

A new `/calendar` page with a left sidebar for category selection (Earnings, Dividend, Economic, IPO) and a content area that supports both table and calendar grid views. Events for stocks in the user's portfolios/watchlists are visually highlighted.

## Data Source

**FMP API** (Financial Modeling Prep) — free tier supports 250 requests/day.

Endpoints:
- Earnings: `GET https://financialmodelingprep.com/api/v3/earning_calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&apikey=KEY`
- Dividends: `GET https://financialmodelingprep.com/api/v3/stock_dividend_calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&apikey=KEY`
- Economic: `GET https://financialmodelingprep.com/api/v3/economic_calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&apikey=KEY`
- IPO: `GET https://financialmodelingprep.com/api/v3/ipo_calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&apikey=KEY`

API key stored in `.env` as `FMP_API_KEY` (server-side only, no `NEXT_PUBLIC_` prefix).

**Rate limiting strategy:** Cache TTL set to 1 hour (calendar data is relatively static). If rate limit is exceeded, API route returns cached data or a user-friendly "data temporarily unavailable" message.

### FMP Response → App Type Mapping

**Earnings:** FMP field `date` → `date`, `symbol` → `symbol`, `eps` → `epsActual`, `epsEstimated` → `epsEstimated`, `revenue` → `revenueActual`, `revenueEstimated` → `revenueEstimated`, `updatedFromDate` → used to determine `time` (bmo/amc)

**Dividends:** FMP field `date` → `date`, `symbol` → `symbol`, `label` → `company`, `dividend` → `dividend`, `adjDividend` → used if `dividend` is null, `paymentDate` → `paymentDate`, `recordDate` → `recordDate`

**Economic:** FMP field `date` → `date`, `event` → `event`, `country` → `country`, `previous` → `previous`, `estimate` → `forecast`, `actual` → `actual`, `impact` → `impact` (FMP provides this directly as Low/Medium/High)

**IPO:** FMP field `date` → `date`, `symbol` → `symbol`, `company` → `company`, `exchange` → `exchange`, `priceRange` → `priceRange`, `shares` → `sharesOffered`, `marketCap` → `marketCap`

## Architecture

Follows existing project patterns:

```
Page Component (src/app/calendar/page.tsx)
  → useCalendar hook (src/hooks/useCalendar.ts)
    → calendarService functions (src/services/calendarService.ts)
      → Next.js API routes (src/app/api/calendar/[type]/route.ts)
        → FMP API (server-side, cached)
```

### API Routes

Single dynamic route: `src/app/api/calendar/[type]/route.ts`

- Accepts `type` param: `earnings`, `dividends`, `economic`, `ipo`
- Validates `type` against allowed values, returns 400 for invalid types
- Query params: `from`, `to` (date range, defaults to today + 30 days)
- Uses existing `lib/cache.ts` pattern — add `calendarCache` with 1 hour TTL
- Normalizes FMP response fields to match app TypeScript interfaces
- Returns normalized JSON

### Cache Addition

Add to `lib/cache.ts`:
```typescript
export const calendarCache = getOrCreateCache<Record<string, unknown>>("calendar", 3600); // 1 hour
```

### Types

```typescript
// src/types/calendar.ts

export type CalendarType = 'earnings' | 'dividends' | 'economic' | 'ipo';

export interface EarningsEvent {
  date: string;
  symbol: string;
  company: string;
  epsEstimated: number | null;
  epsActual: number | null;
  revenueEstimated: number | null;
  revenueActual: number | null;
  time: 'bmo' | 'amc' | null; // before market open / after market close (from FMP updatedFromDate)
  isPortfolioStock: boolean;
}

export interface DividendEvent {
  date: string; // ex-dividend date
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
  impact: 'High' | 'Medium' | 'Low'; // FMP provides this directly
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

### Service Functions

```typescript
// src/services/calendarService.ts

export async function fetchCalendarData(
  type: CalendarType,
  from: string,
  to: string
): Promise<CalendarEvent[]>
```

Single function that calls `/api/calendar/${type}?from=${from}&to=${to}`. Returns the normalized array.

### Hook: useCalendar

```typescript
// src/hooks/useCalendar.ts
function useCalendar(type: CalendarType, dateRange: { from: string; to: string })
```

- Fetches data via `calendarService`
- Uses `usePortfolioStore((s) => s.portfolios)` and `useWatchlistStore((s) => s.watchlists)` to get all held/watched tickers
- Sets `isPortfolioStock = true` client-side for any event whose `symbol` matches a portfolio holding or watchlist ticker
- Returns `{ data, isLoading, error }`
- Auto-refreshes every 15 minutes via `setInterval` in `useEffect`

## UI Components

### Page Layout

```
src/app/calendar/page.tsx
src/components/calendar/
  ├── CalendarSidebar.tsx        # Left sidebar with category list
  ├── CalendarContent.tsx        # Main content area (header + view)
  ├── CalendarHeader.tsx         # Date range picker + view toggle
  ├── CalendarTableView.tsx      # Table display (delegates to type-specific tables)
  ├── CalendarGridView.tsx       # Month calendar grid
  ├── EarningsTable.tsx          # Earnings-specific table columns
  ├── DividendTable.tsx          # Dividend-specific table columns
  ├── EconomicTable.tsx          # Economic-specific table columns
  └── IpoTable.tsx               # IPO-specific table columns
```

### Sidebar (CalendarSidebar)

- Fixed width: 220px
- On mobile (<768px): collapses to horizontal tab bar across the top
- 4 items, each with:
  - Lucide icon (TrendingUp for Earnings, DollarSign for Dividends, Globe for Economic, Rocket for IPO)
  - Label text
  - Count badge (number of events in current date range, computed from fetched data)
- Active item: green text + green left border (2px) accent
- Dark background matching `--bg-secondary`
- Date range is preserved when switching between calendar types

### Content Header (CalendarHeader)

- Date range preset buttons: This Week, This Month, Next Month
- Custom date range picker (from/to date inputs)
- View toggle: Table icon / Grid icon (toggle between views)
- Default: This Month, Table view

### Table View (CalendarTableView)

Renders the appropriate table component based on selected calendar type.

**Earnings columns:** Date, Company (with ticker), EPS Est., EPS Actual, Revenue Est., Time (BMO/AMC badge)
**Dividend columns:** Ex-Date, Company (with ticker), Amount, Yield, Payment Date
**Economic columns:** Date, Event, Country, Previous, Forecast, Actual, Impact (colored badge: red=High, yellow=Medium, gray=Low)
**IPO columns:** Expected Date, Company (with ticker), Exchange, Price Range, Shares Offered, Market Cap

Sorting: Click column headers to sort. Default sort by date ascending.

Portfolio highlighting: Rows where `isPortfolioStock === true` get:
- Subtle green left border (2px)
- Small portfolio icon badge next to the ticker
- Slightly elevated background (`--bg-elevated`)

**Empty state:** "No {type} events in this date range" with calendar icon.

**Loading state:** Skeleton rows (3-5 rows) matching existing skeleton patterns.

### Calendar Grid View (CalendarGridView)

- Standard month grid (7 columns for days of week)
- Month owned by CalendarGridView component state, initialized to current month
- Each day cell shows colored dots for events (max 3 dots + "+N" indicator):
  - Green = Earnings
  - Blue = Dividends
  - Orange = Economic events
  - Purple = IPOs
- Clicking a day opens a single shared dialog/popover (not per-cell) showing that day's events
- Today's date: highlighted border
- Month navigation arrows (< Month Year >)
- Shows only the selected calendar type's dots (based on sidebar selection)

## Navigation

Add "Calendar" link to the navbar between "Radar" and "Rebalance":
- File: `src/components/layout/Navbar.tsx`
- Icon: `CalendarDays` from Lucide
- Path: `/calendar`

## File Changes Summary

**New files:**
- `src/app/calendar/page.tsx` — Page component
- `src/app/api/calendar/[type]/route.ts` — API route (validates type, proxies to FMP, normalizes response)
- `src/services/calendarService.ts` — FMP API service
- `src/hooks/useCalendar.ts` — Data fetching hook with portfolio cross-referencing
- `src/types/calendar.ts` — TypeScript interfaces
- `src/components/calendar/CalendarSidebar.tsx`
- `src/components/calendar/CalendarContent.tsx`
- `src/components/calendar/CalendarHeader.tsx`
- `src/components/calendar/CalendarTableView.tsx`
- `src/components/calendar/CalendarGridView.tsx`
- `src/components/calendar/EarningsTable.tsx`
- `src/components/calendar/DividendTable.tsx`
- `src/components/calendar/EconomicTable.tsx`
- `src/components/calendar/IpoTable.tsx`

**Modified files:**
- `src/components/layout/Navbar.tsx` — Add Calendar nav link
- `src/lib/cache.ts` — Add `calendarCache` instance
- `.env` — Add `FMP_API_KEY`

## Verification

1. Add FMP_API_KEY to `.env` and verify API connectivity
2. Test each API route individually (`/api/calendar/earnings`, etc.) via browser
3. Navigate to `/calendar` and verify:
   - Sidebar switches between calendar types
   - Table view shows real data with correct columns
   - Calendar grid view shows event dots on correct dates
   - Clicking a day in grid shows event details
   - Portfolio stocks are highlighted in table rows
   - Date range presets filter data correctly
   - View toggle switches between table and grid
   - Empty states display when no events exist
   - Loading skeletons show during fetch
4. Verify navbar shows Calendar link and active state works
5. Test mobile: sidebar collapses to horizontal tabs, table scrolls horizontally
6. Run `npm run build` to confirm no TypeScript errors
