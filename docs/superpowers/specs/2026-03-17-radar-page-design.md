# Radar Page — Design Spec

## Context

Oakstock needs a stock discovery page where users can browse stocks organized by industry sector. The page lets users select a GICS sector from a filter banner and see curated stocks for that sector displayed as cards — identical to the existing watchlist card format. Users can expand cards for detail (chart, financials, description) and quick-add stocks to their watchlists.

## Sectors

All 11 GICS sectors, each with ~10-15 curated tickers:

1. Energy
2. Information Technology
3. Financials
4. Health Care
5. Consumer Discretionary
6. Consumer Staples
7. Industrials
8. Materials
9. Utilities
10. Real Estate
11. Communication Services

Default selected sector on page load: **Energy** (first in the list).

## Page Layout

### Header
- Page title: "Radar"
- Subtitle: "Discover stocks by sector"

### Sector Filter Banner
- Horizontal row of pill-shaped buttons, one per sector
- Selected pill: green filled (`bg-green-primary`, dark text)
- Unselected pills: dark background (`bg-bg-tertiary`) with border
- Wraps on desktop, horizontally scrollable on mobile (overflow-x-auto)
- Clicking a pill selects that sector and loads its stocks
- Only one sector selected at a time

### Stock Card Grid
- Responsive grid: 1 col mobile, 2 col md, 3 col xl (matches watchlist)
- Each card is identical to `WatchlistCard` in appearance:
  - Company logo (logo.dev API with fallback)
  - Ticker symbol, company name, market cap
  - Current price + day change badge
  - Performance pills (1M, 3M, YTD, 1Y, 3Y, 5Y)
- Clicking a card expands the accordion detail view (chart, financials, analyst data, description)
- Only one card expanded at a time
- **"+ Add to Watchlist" button** at the bottom of each card (visible without expanding)
  - Opens a dropdown to select which watchlist to add to
  - If stock already exists in selected watchlist, show toast "Already in watchlist"
  - Uses existing `useWatchlistStore.addItem()`

## Data Architecture

### Curated Ticker Lists
- New constant `RADAR_SECTORS` in `src/utils/constants.ts`
- Maps each sector name to an array of ticker strings
- ~10-15 well-known, liquid tickers per sector

Example structure:
```typescript
export const RADAR_SECTORS: Record<string, { label: string; tickers: string[] }> = {
  energy: {
    label: "Energy",
    tickers: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HAL", "DVN", "FANG", "BKR"]
  },
  // ... 10 more sectors
};
```

### Data Fetching
- Use existing `useQuotes` hook to batch-fetch quotes for all tickers in the selected sector
- Reuse `usePerformanceReturns` for performance pills (already per-card, lazy)
- Reuse `useFinancials` for expanded detail view (already per-card, lazy)
- No new API endpoints needed — all existing hooks work

### State Management
- Sector selection: local React state (`useState`) — no persistence needed
- Expanded card: local React state (same pattern as watchlist page)
- No new Zustand store needed — radar is stateless (curated data + live quotes)

## Components

### New Files
1. **`src/app/radar/page.tsx`** — Main page component
   - Manages selected sector state
   - Manages expanded card state
   - Fetches quotes via `useQuotes` for current sector's tickers
   - Renders sector filter banner + card grid

2. **`src/components/radar/RadarCard.tsx`** — Stock card for radar
   - Reuses `CompanyLogo`, `PerformancePills` from watchlist (extract to shared)
   - Same visual structure as `WatchlistCard`
   - Replaces "Edit target price & notes" with "Add to Watchlist" dropdown
   - Accordion detail reuses `WatchlistCardDetail` component directly

3. **`src/components/radar/RadarGrid.tsx`** — Grid wrapper
   - Same responsive grid as `WatchlistGrid`

### Shared Component Extraction
The following should be extracted from `WatchlistCard.tsx` into shared locations for reuse:
- `CompanyLogo` → `src/components/shared/CompanyLogo.tsx`
- `PerformancePills` → `src/components/shared/PerformancePills.tsx`

### Modified Files
1. **`src/components/layout/Navbar.tsx`** — Add "Radar" nav link
2. **`src/utils/constants.ts`** — Add `RADAR_SECTORS` constant

## Add to Watchlist Flow
1. User clicks "+ Add to Watchlist" on a radar card
2. Dropdown appears showing all user's watchlists (from `useWatchlistStore`)
3. User selects a watchlist
4. Stock is added via `addItem(watchlistId, { ticker, name })`
5. Toast confirmation: "Added {ticker} to {watchlistName}"
6. If already in that watchlist: toast "Already in {watchlistName}"

## Verification
- Navigate to `/radar` — page loads with Energy selected by default
- Click through each of the 11 sector pills — cards update to show that sector's stocks
- Cards show live prices, day change, and performance pills
- Click a card — accordion expands with chart and financials
- Click "+ Add to Watchlist" — dropdown shows user's watchlists
- Add a stock — verify it appears in the watchlist page
- Mobile responsive: pills scroll horizontally, cards stack to 1 column
