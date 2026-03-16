# Oakstock — Portfolio Intelligence Platform

## Product Vision

Oakstock is a portfolio tracking and intelligence web app for self-directed investors. It pulls real-time market data from Yahoo Finance, lets users build and manage multiple portfolios with full lot-level tracking, visualizes performance through interactive charts, benchmarks against major indices, and provides AI-powered rebalancing suggestions. The aesthetic is inspired by its name — oak, stock, growth — with a dark-first design built on black, green, and warm oak-brown tones.

**Comparable product**: Qualtrim (by Joseph Carlson) — Oakstock aims for a similar level of polish with beautiful charts, portfolio insights, and stock analysis, but as a web app rather than mobile-first, with a stronger focus on portfolio construction and rebalancing intelligence.

**Target user**: Self-directed investors who hold stocks and ETFs, want a clean consolidated view of their portfolios, and want intelligent suggestions — not just data.

**Business model**: Personal tool first, public product later. Build for one user now, architect for many.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 14+ (App Router)** | SSR for eventual public launch, API routes for proxy layer, file-based routing |
| Language | **TypeScript** | Type safety across the entire app |
| Styling | **Tailwind CSS v4** + CSS variables | Utility-first with theme token support |
| Charts | **Recharts** | React-native charting, composable, good dark mode support |
| State | **Zustand** (persist middleware) | Lightweight, localStorage persistence for MVP |
| Market Data | **yahoo-finance2** (Node.js) | No API key needed, runs server-side in Next.js API routes |
| Database (future) | **Supabase** (Postgres + Auth + Realtime) | Spec'd in, not built yet — localStorage for MVP |
| Auth (future) | **Supabase Auth** | Spec'd in, not built yet — no login required for MVP |
| Date Handling | **date-fns** | Lightweight date formatting and manipulation |
| Icons | **Lucide React** | Clean, consistent icon set |
| AI Rebalancing | **Anthropic Claude API** (via API route) | AI-powered portfolio suggestions (can stub with mock data for MVP) |
| News | **Yahoo Finance news** or **RSS feeds** | Portfolio-relevant news feed |

### Key Architecture Decision: Next.js API Routes as Proxy

Yahoo Finance (`yahoo-finance2`) is a Node.js library — it cannot run in the browser. Instead of a separate Express server, use **Next.js API routes** (`app/api/`) to proxy all Yahoo Finance calls. This keeps the project as a single deployable unit.

---

## Brand & Design System

### Brand Identity
- **Name**: Oakstock
- **Tagline**: "Rooted in growth."
- **Logo concept**: A minimal oak leaf silhouette integrated with a subtle upward chart line, next to the wordmark "OAKSTOCK" in a refined display font
- **Personality**: Grounded, intelligent, trustworthy — a tool that feels like it was built by an investor, for investors

### Color Palette

All colors defined as CSS variables on `:root` (dark) and `[data-theme="light"]` selectors. Dark mode is the default.

#### Dark Mode (Default)
```css
:root {
  /* Backgrounds */
  --bg-primary: #0C0C0C;          /* Deep black — main canvas */
  --bg-secondary: #151512;         /* Warm dark — cards, panels */
  --bg-tertiary: #1E1D1A;          /* Warm charcoal — inputs, hover states */
  --bg-elevated: #252420;          /* Elevated surfaces — dropdowns, modals */

  /* Oak / Warm Brown Accents */
  --oak-100: #D4C4A8;              /* Light oak — secondary text, subtle labels */
  --oak-200: #B8A88E;              /* Mid oak — borders, dividers */
  --oak-300: #8B7355;              /* Rich oak — accent elements */
  --oak-400: #6B5740;              /* Deep oak — active nav, highlights */
  --oak-500: #4A3C2A;              /* Dark oak — subtle backgrounds */

  /* Green Accents */
  --green-primary: #22C55E;        /* Bright green — primary CTA, positive values */
  --green-hover: #16A34A;          /* Green hover/active states */
  --green-glow: rgba(34,197,94,0.12); /* Subtle green glow for focus states */
  --green-muted: #1A3A2A;          /* Dark green tint — positive value backgrounds */

  /* Red (losses only) */
  --red-primary: #EF4444;          /* Losses, negative values */
  --red-muted: #3A1A1A;            /* Dark red tint — negative value backgrounds */

  /* Text */
  --text-primary: #F0EDE8;         /* Warm white — primary text */
  --text-secondary: #A09882;        /* Muted oak — secondary text */
  --text-tertiary: #6B6355;         /* Dim — timestamps, labels */

  /* Borders */
  --border-primary: #2A2722;        /* Card borders */
  --border-secondary: #1E1D1A;      /* Subtle dividers */
}
```

#### Light Mode
```css
[data-theme="light"] {
  --bg-primary: #FAF8F5;           /* Warm off-white */
  --bg-secondary: #FFFFFF;          /* Pure white cards */
  --bg-tertiary: #F0EDE8;           /* Warm light gray — inputs */
  --bg-elevated: #FFFFFF;

  --oak-100: #6B5740;
  --oak-200: #8B7355;
  --oak-300: #B8A88E;
  --oak-400: #D4C4A8;
  --oak-500: #F0EDE8;

  --green-primary: #16A34A;
  --green-hover: #15803D;
  --green-glow: rgba(22,163,74,0.08);
  --green-muted: #ECFDF5;

  --red-primary: #DC2626;
  --red-muted: #FEF2F2;

  --text-primary: #1A1814;
  --text-secondary: #6B6355;
  --text-tertiary: #A09882;

  --border-primary: #E0DCD4;
  --border-secondary: #F0EDE8;
}
```

### Typography
- **Display / Headings**: `"Instrument Sans"` (Google Fonts) — bold, tight letter-spacing (-0.03em). Distinctive without being flashy.
- **Body**: `"Instrument Sans"` regular/medium
- **Monospace (numbers, tickers, prices)**: `"JetBrains Mono"` — for all financial data, ticker symbols, percentages, dollar amounts
- **Font sizes**: Use a modular scale — 12px / 14px / 16px / 20px / 24px / 32px / 40px

### Design Principles
1. **Dark canvas, warm accents**: The black background isn't cold — the oak-brown tones add warmth and sophistication
2. **Green means growth**: Green is the primary action color. Buttons, positive values, chart lines, CTAs — all green
3. **Red means loss**: Red only appears for negative returns. Never decorative.
4. **Oak-brown is the signature**: The warm brown tones differentiate Oakstock from every other dark-mode fintech app. Use it for borders, secondary text, nav highlights, subtle backgrounds.
5. **Numbers are monospaced**: Every dollar value, percentage, ticker symbol, and date uses JetBrains Mono
6. **Card-based layout**: Content lives in cards with `border-radius: 12px`, `border: 1px solid var(--border-primary)`, and `background: var(--bg-secondary)`
7. **Breathing room**: Generous padding (24px inside cards, 16-24px gaps between cards). Let the dark background show.
8. **Subtle motion**: 150ms ease transitions on hover. Gentle scale(1.005) on card hover. Green glow on focused inputs. Chart animations on load (800ms).

---

## Application Structure

### Pages & Routing (Next.js App Router)

```
app/
├── layout.tsx                    # Root layout — top navbar, theme provider
├── page.tsx                      # Dashboard (default landing page)
├── portfolio/
│   └── [id]/
│       └── page.tsx              # Portfolio detail page
├── watchlist/
│   └── page.tsx                  # Watchlist page
├── rebalance/
│   └── page.tsx                  # AI Rebalancing page
├── api/
│   ├── quote/route.ts            # GET — single ticker quote
│   ├── quotes/route.ts           # GET — batch quotes
│   ├── search/route.ts           # GET — ticker search/autocomplete
│   ├── history/route.ts          # GET — historical price data
│   ├── news/route.ts             # GET — news for tickers
│   └── rebalance/route.ts        # POST — AI rebalancing suggestions
```

### Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx              # Top navigation bar
│   │   ├── ThemeToggle.tsx         # Dark/light mode switch
│   │   └── MarketOverviewBar.tsx   # Scrolling ticker bar (S&P 500, TSX, NASDAQ)
│   ├── dashboard/
│   │   ├── PortfolioSummaryCards.tsx  # Total value, gain/loss, day change
│   │   ├── PortfolioGrid.tsx         # Grid of portfolio cards
│   │   ├── PortfolioCard.tsx         # Individual portfolio card with sparkline
│   │   ├── CombinedChart.tsx         # Combined portfolio performance chart
│   │   ├── NewsFeed.tsx              # Portfolio-relevant news
│   │   └── EconomicCalendar.tsx      # Upcoming events (rate decisions, earnings)
│   ├── portfolio/
│   │   ├── PortfolioHeader.tsx       # Name, description, summary stats
│   │   ├── PerformanceChart.tsx      # Main area chart with time range selector
│   │   ├── BenchmarkOverlay.tsx      # Benchmark comparison line on chart
│   │   ├── HoldingsTable.tsx         # Full holdings table with sorting
│   │   ├── HoldingRow.tsx            # Individual holding row (expandable)
│   │   ├── HoldingLots.tsx           # Lot-level detail for a holding
│   │   ├── AllocationChart.tsx       # Donut chart — allocation by holding
│   │   ├── SectorBreakdown.tsx       # Sector allocation visualization
│   │   ├── AddHoldingModal.tsx       # Modal to add a new holding
│   │   └── EditHoldingModal.tsx      # Modal to edit holding / manage lots
│   ├── watchlist/
│   │   ├── WatchlistTable.tsx        # Watchlist with live quotes
│   │   └── AddToWatchlistModal.tsx   # Search + add ticker to watchlist
│   ├── rebalance/
│   │   ├── RebalanceSetup.tsx        # Select portfolio + set goals
│   │   ├── RebalanceSuggestions.tsx   # AI-generated suggestions
│   │   └── RebalanceActions.tsx       # Actionable buy/sell recommendations
│   ├── search/
│   │   └── TickerSearch.tsx          # Autocomplete ticker search (debounced)
│   └── ui/
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Input.tsx
│       ├── Badge.tsx
│       ├── Skeleton.tsx              # Loading skeleton shimmer
│       ├── Toast.tsx                 # Toast notifications
│       └── ConfirmDialog.tsx         # Confirmation dialogs
├── stores/
│   ├── portfolioStore.ts            # All portfolio & holding state
│   ├── watchlistStore.ts            # Watchlist state
│   └── themeStore.ts                # Theme preference
├── services/
│   ├── yahooFinance.ts              # Client-side API calls to Next.js API routes
│   └── rebalanceAI.ts              # Client-side call to AI rebalancing endpoint
├── utils/
│   ├── formatters.ts                # Currency, %, date formatting
│   ├── calculations.ts             # Portfolio performance math
│   └── constants.ts                # Benchmarks, defaults
├── types/
│   └── index.ts                    # All TypeScript interfaces
└── hooks/
    ├── useQuotes.ts                # Hook to fetch & cache live quotes
    ├── useHistory.ts               # Hook to fetch historical data
    └── useDebounce.ts              # Debounce hook for search
```

---

## Data Models

```typescript
// types/index.ts

// ─── Portfolio ───────────────────────────────────────
interface Portfolio {
  id: string;
  name: string;
  description?: string;
  createdAt: string;               // ISO date
  benchmark: string;               // Ticker to benchmark against, e.g., "SPY", "XIU.TO"
  holdings: Holding[];
}

// ─── Holdings & Lots ─────────────────────────────────
interface Holding {
  id: string;
  ticker: string;                  // e.g., "VOO", "XIU.TO"
  name: string;                    // e.g., "Vanguard S&P 500 ETF"
  currency: "CAD" | "USD";
  lots: Lot[];                     // Multiple buy lots per holding
  notes?: string;
}

interface Lot {
  id: string;
  shares: number;
  costPerShare: number;            // Price paid per share in this lot
  purchaseDate: string;            // ISO date
  notes?: string;
}

// ─── Computed (not stored, derived at runtime) ───────
interface HoldingWithQuote extends Holding {
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  totalShares: number;             // Sum of all lot shares
  avgCostBasis: number;            // Weighted avg across lots
  marketValue: number;             // totalShares * currentPrice
  totalCost: number;               // Sum of (lot.shares * lot.costPerShare)
  gainLoss: number;                // marketValue - totalCost
  gainLossPercent: number;         // (gainLoss / totalCost) * 100
  peRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  sector?: string;
}

// ─── Watchlist ───────────────────────────────────────
interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  addedAt: string;
  targetPrice?: number;            // Optional price alert
  notes?: string;
}

// ─── Market Data ─────────────────────────────────────
interface QuoteData {
  ticker: string;
  name: string;
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  marketCap?: number;
  peRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  sector?: string;
  currency: string;
}

interface HistoricalDataPoint {
  date: string;                    // ISO date
  close: number;
}

// ─── AI Rebalancing ──────────────────────────────────
interface RebalanceRequest {
  portfolioId: string;
  goal: "growth" | "income" | "balanced" | "conservative";
  riskTolerance: "low" | "medium" | "high";
  investmentHorizon: "short" | "medium" | "long";   // <3yr, 3-10yr, 10yr+
  additionalCapital?: number;      // Optional: "I have $5000 to deploy"
}

interface RebalanceSuggestion {
  ticker: string;
  name: string;
  currentAllocation: number;       // Current % of portfolio
  suggestedAllocation: number;     // Suggested % of portfolio
  action: "buy" | "sell" | "hold";
  sharesToTrade: number;
  reasoning: string;               // AI-generated explanation
}

// ─── Economic Calendar ───────────────────────────────
interface CalendarEvent {
  date: string;
  title: string;
  type: "earnings" | "rate_decision" | "economic_data";
  relevantTicker?: string;
}
```

---

## Feature Specifications

### 1. Top Navbar (persistent across all pages)

**Layout**: Fixed top bar, full width, height 64px.
**Background**: `var(--bg-secondary)` with bottom border `var(--border-primary)`.

**Contents (left to right)**:
- **Logo**: Oak leaf icon + "OAKSTOCK" wordmark in `Instrument Sans` bold. Icon in `var(--green-primary)`, text in `var(--text-primary)`.
- **Nav links**: Dashboard | Watchlist | Rebalance — horizontal links. Active link has bottom border in `var(--green-primary)` and text in `var(--green-primary)`. Inactive links in `var(--text-secondary)`, hover to `var(--text-primary)`.
- **Right side**: Theme toggle (sun/moon icon) + user avatar placeholder (for future auth).

**Mobile**: Hamburger menu collapses nav links into a dropdown.

### 2. Market Overview Bar (below navbar)

A thin horizontal bar (40px height) that shows live-updating index data.

**Contents**: Scrolling or static row of major indices:
- S&P 500 (^GSPC) | TSX Composite (^GSPTSE) | NASDAQ (^IXIC) | DOW (^DJI)
- Each shows: Index name, current value, day change ($), day change (%) — color-coded green/red
- **Background**: `var(--bg-tertiary)` — slightly different from navbar to create visual separation
- **Auto-refresh**: Poll every 60 seconds during market hours

### 3. Dashboard Page (`/`)

The default landing page. Shows a high-level overview of everything.

#### 3a. Summary Cards Row
Three cards across the top:
- **Total Portfolio Value**: Sum of all portfolios. Large number in `JetBrains Mono`. Dollar sign in `var(--text-secondary)`.
- **Total Gain/Loss**: Dollar amount + percentage. Green or red based on value. Background tint using `var(--green-muted)` or `var(--red-muted)`.
- **Day Change**: Today's change across all portfolios. Same green/red treatment.

#### 3b. Portfolio Cards Grid
Grid of cards (2-3 columns on desktop, 1 on mobile). One card per portfolio.

Each card shows:
- Portfolio name (bold)
- Total current value (large, monospaced)
- Gain/loss $ and % (color-coded)
- Number of holdings
- Mini sparkline (last 30 days, 120px wide × 40px tall, no axes — just the line, green if up, red if down)
- Click anywhere on card → navigates to `/portfolio/[id]`

**Empty state**: If no portfolios exist, show centered content: oak tree illustration/icon, "Plant your first portfolio" heading, "Create Portfolio" green CTA button.

#### 3c. Combined Performance Chart
Full-width area chart showing combined value of all portfolios over time.
- **Time range selector pills**: 1W | 1M | 3M | 6M | 1Y | ALL — positioned above chart, right-aligned
- Active pill: `background: var(--green-primary)`, text white. Inactive: ghost style with `var(--border-primary)` border.
- **Chart line**: `var(--green-primary)`
- **Fill**: Linear gradient from `var(--green-primary)` at 20% opacity → transparent
- **Tooltip**: Custom dark tooltip showing date + formatted value
- **Height**: 350px desktop, 250px mobile

#### 3d. News Feed Section
Below the chart. Shows recent news articles relevant to tickers held across all portfolios.
- Each news item: Headline (linked), source, timestamp, relevant ticker badge
- Max 10 items, scrollable
- Fetched from Yahoo Finance news endpoint via API route

#### 3e. Economic Calendar Widget
Sidebar or below news. Shows upcoming events:
- Earnings dates for holdings
- Central bank rate decisions (Fed, BoC)
- Major economic releases
- Each event: date, title, type badge (earnings/rate/economic), relevant ticker if applicable

### 4. Portfolio Detail Page (`/portfolio/[id]`)

#### 4a. Portfolio Header
- **Portfolio name**: Large, editable inline (click to edit, Enter to save)
- **Description**: Smaller text below, also editable inline
- **Benchmark selector**: Dropdown to choose benchmark index (SPY, XIU.TO, QQQ, ^GSPTSE, ^GSPC). Stored on the portfolio.
- **Actions**: "Add Holding" button (green CTA), "Delete Portfolio" (ghost red, with confirmation dialog)

#### 4b. Performance Summary Bar
Horizontal row of key stats:
- **Current Value**: Large monospaced number
- **Total Gain/Loss ($)**: Color-coded green/red
- **Total Gain/Loss (%)**: Color-coded green/red
- **Day Change ($)**: Color-coded
- **Day Change (%)**: Color-coded

#### 4c. Portfolio Performance Chart (main feature)
Large area chart, full width, 400px height.
- **Portfolio line**: Solid `var(--green-primary)` area fill (gradient to transparent)
- **Benchmark overlay**: Dashed line in `var(--oak-300)` showing the benchmark's performance over the same period, normalized to the same starting value so they're visually comparable
- **Cost basis line**: Thin dashed horizontal line in `var(--text-tertiary)` showing total cost basis
- **Time range pills**: 1W | 1M | 3M | 6M | 1Y | ALL
- **Legend**: Small legend below chart — "Portfolio" (green dot) | "S&P 500" (oak dot) | "Cost Basis" (gray dashed)
- **Tooltip**: Shows date, portfolio value, benchmark value, and difference
- **Animate on mount**: 800ms ease animation

#### 4d. Holdings Table
Full-featured sortable table.

**Columns**:
| Ticker | Name | Shares | Avg Cost | Current Price | Market Value | Gain/Loss ($) | Gain/Loss (%) | Day Chg (%) | P/E | 52W Range |
|--------|------|--------|----------|--------------|-------------|---------------|---------------|-------------|-----|-----------|

- **Ticker**: Displayed in `JetBrains Mono`, bold, `var(--text-primary)`
- **Gain/Loss columns**: Green or red text + background tint
- **52W Range**: Visual bar showing current price position within the range
- **Sort**: Click any column header to sort asc/desc. Active sort column shows arrow indicator.
- **Expandable rows**: Click a row to expand and show:
  - Individual lots (date, shares, cost per share, lot gain/loss)
  - Sector tag
  - Notes
  - Edit / Delete buttons per lot
- **Add Holding button**: At the top of the table, green CTA

#### 4e. Allocation Donut Chart
Side-by-side with the holdings table (on desktop) or below it (mobile).
- **Donut chart** using Recharts `PieChart` with `innerRadius`
- **Color palette**: Generate a range from `var(--green-primary)` through `var(--oak-300)` to `var(--oak-500)` — each holding gets a distinct shade
- **Labels**: Ticker + percentage on each segment
- **Center**: Total portfolio value

#### 4f. Sector Breakdown
Below allocation chart. Horizontal bar chart showing % of portfolio in each sector.
- Bars colored with the oak/green palette
- Sectors pulled from Yahoo Finance quote data (`sector` field)

### 5. Add / Edit Holding Modal

Full-screen sheet on mobile, centered modal on desktop (max-width 500px).

**Step 1 — Search for Ticker**:
- Large search input with magnifying glass icon
- Debounced autocomplete (300ms) querying `/api/search`
- Results show: Ticker | Company Name | Exchange
- Click a result to select it and auto-fill ticker + name

**Step 2 — Enter Lot Details**:
- **Shares**: Number input (min 0.001 for fractional shares)
- **Cost Per Share**: Number input with $ prefix
- **Currency**: Toggle — CAD or USD (default based on exchange: .TO tickers default CAD, others USD)
- **Purchase Date**: Date picker (defaults to today)
- **Notes**: Optional textarea

**Adding to existing holding**: If the ticker already exists in the portfolio, show a note: "Adding a new lot to existing [TICKER] holding" and add the lot to the existing holding rather than creating a duplicate.

**Validation**: All required fields filled, shares > 0, cost > 0, date not in the future.

**On submit**: Add holding/lot to store, fetch fresh quote data, close modal, show toast "Added [SHARES] shares of [TICKER]".

### 6. Watchlist Page (`/watchlist`)

Simple, focused page for tracking tickers you're interested in but haven't bought.

**Table columns**: Ticker | Name | Current Price | Day Change (%) | 52W High | 52W Low | P/E | Target Price | Added Date | Actions

- **Target price**: If set, show a badge — "Above target" (red) or "Below target" (green) based on current price vs target
- **Add button**: Opens a modal with ticker search + optional target price + notes
- **Quick action**: "Add to Portfolio" button per row — opens the Add Holding modal pre-filled with that ticker
- **Remove**: Trash icon per row with confirmation

### 7. AI Rebalancing Page (`/rebalance`)

#### Step 1 — Setup
- **Select portfolio**: Dropdown of user's portfolios
- **Investment goal**: Card selector — Growth | Income | Balanced | Conservative. Each card has an icon and one-line description.
- **Risk tolerance**: Slider or 3-option selector — Low | Medium | High
- **Time horizon**: Short (<3yr) | Medium (3-10yr) | Long (10yr+)
- **Additional capital**: Optional input — "I have $X more to invest"

#### Step 2 — AI Analysis (loading state with skeleton)

Calls the `/api/rebalance` endpoint which sends the portfolio data + goals to Claude API (or returns mock data for MVP).

#### Step 3 — Suggestions Display
- **Summary card**: "Based on your [goal] goal with [risk] risk tolerance over a [horizon] horizon, here's what we suggest:"
- **Suggestions table**: One row per holding showing current allocation %, suggested allocation %, action (Buy/Sell/Hold badge), shares to trade, and AI reasoning
- **New positions**: If the AI suggests tickers not currently in the portfolio, show them in a separate "Consider Adding" section
- **Disclaimer**: Small text: "These suggestions are AI-generated and not financial advice. Always do your own research."

---

## Yahoo Finance API Integration

All Yahoo Finance calls go through **Next.js API routes** (server-side only). The `yahoo-finance2` npm package runs in Node.js within these routes.

### API Route: `/api/quote` (GET)
```
Query: ?ticker=VOO
Returns: QuoteData object
Uses: yahoo-finance2 .quote() method
```

### API Route: `/api/quotes` (GET)
```
Query: ?tickers=VOO,QQQ,AAPL,XIU.TO
Returns: QuoteData[] array
Uses: yahoo-finance2 .quote() with array of tickers
```

### API Route: `/api/search` (GET)
```
Query: ?q=vanguard
Returns: Array of { ticker, name, exchange, type }
Uses: yahoo-finance2 .search() method
```

### API Route: `/api/history` (GET)
```
Query: ?ticker=VOO&period=1y
Period options: 1w, 1m, 3m, 6m, 1y, 5y, max
Returns: HistoricalDataPoint[] array
Uses: yahoo-finance2 .historical() method with appropriate date range
```

### API Route: `/api/news` (GET)
```
Query: ?tickers=VOO,QQQ,AAPL
Returns: Array of { title, link, source, publishDate, relatedTicker }
Uses: yahoo-finance2 or RSS feed parsing
```

### API Route: `/api/rebalance` (POST)
```
Body: RebalanceRequest object + current holdings data
Returns: RebalanceSuggestion[] array
Uses: Anthropic Claude API call with portfolio context in prompt
(For MVP: can return mock/hardcoded suggestions)
```

### Currency Conversion
For dual CAD/USD support:
- Fetch `CADUSD=X` exchange rate from Yahoo Finance
- Cache the rate (refresh every 15 minutes)
- All portfolio totals displayed in user's preferred currency
- Show original currency per holding + converted value

### Error Handling & Caching
- Cache quote data for 60 seconds (avoid hammering Yahoo Finance)
- Cache historical data for 5 minutes
- If Yahoo Finance returns an error, show last cached data with a "Data may be delayed" banner
- Retry failed requests once after 2 seconds
- Rate limit: Max 5 concurrent requests to Yahoo Finance

---

## Portfolio Calculations (`utils/calculations.ts`)

```typescript
// Total shares for a holding (sum across lots)
totalShares(holding) = sum(lot.shares for lot in holding.lots)

// Weighted average cost basis for a holding
avgCostBasis(holding) = sum(lot.shares * lot.costPerShare) / totalShares

// Market value for a holding
marketValue(holding) = totalShares * currentPrice

// Total cost for a holding
totalCost(holding) = sum(lot.shares * lot.costPerShare for lot in holding.lots)

// Gain/loss for a holding
gainLoss(holding) = marketValue - totalCost
gainLossPercent(holding) = (gainLoss / totalCost) * 100

// Portfolio-level totals (sum across all holdings, converted to base currency)
portfolioValue = sum(marketValue for each holding, converted)
portfolioCost = sum(totalCost for each holding, converted)
portfolioGainLoss = portfolioValue - portfolioCost
portfolioGainLossPercent = (portfolioGainLoss / portfolioCost) * 100

// Day change for portfolio
portfolioDayChange = sum(holding.totalShares * holding.dayChange, converted)
portfolioDayChangePercent = (portfolioDayChange / (portfolioValue - portfolioDayChange)) * 100

// Historical portfolio value for charting:
// For each date in range:
//   portfolioValueOnDate = sum(holding.totalShares * holding.closePriceOnDate, converted)
// Requires fetching historical data for each holding and aligning dates

// Benchmark normalization for comparison:
// benchmarkNormalized[date] = benchmarkClose[date] / benchmarkClose[startDate] * portfolioValue[startDate]
// This makes the benchmark line start at the same value as the portfolio for visual comparison
```

---

## State Management

### `stores/portfolioStore.ts` (Zustand + persist)
```typescript
interface PortfolioStore {
  portfolios: Portfolio[];
  activePortfolioId: string | null;

  // Portfolio CRUD
  createPortfolio: (name: string, description?: string, benchmark?: string) => void;
  updatePortfolio: (id: string, updates: Partial<Portfolio>) => void;
  deletePortfolio: (id: string) => void;
  setActivePortfolio: (id: string | null) => void;

  // Holding CRUD
  addHolding: (portfolioId: string, holding: Omit<Holding, 'id'>) => void;
  updateHolding: (portfolioId: string, holdingId: string, updates: Partial<Holding>) => void;
  removeHolding: (portfolioId: string, holdingId: string) => void;

  // Lot CRUD
  addLot: (portfolioId: string, holdingId: string, lot: Omit<Lot, 'id'>) => void;
  updateLot: (portfolioId: string, holdingId: string, lotId: string, updates: Partial<Lot>) => void;
  removeLot: (portfolioId: string, holdingId: string, lotId: string) => void;
}
```

### `stores/watchlistStore.ts` (Zustand + persist)
```typescript
interface WatchlistStore {
  items: WatchlistItem[];
  addItem: (item: Omit<WatchlistItem, 'id' | 'addedAt'>) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<WatchlistItem>) => void;
}
```

### `stores/themeStore.ts` (Zustand + persist)
```typescript
interface ThemeStore {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}
```

All stores use Zustand's `persist` middleware with `localStorage` as the storage layer. When Supabase is added later, the persist layer can be swapped to sync with the database.

---

## Chart Specifications

### Performance Area Chart (Recharts)
```
Component: <AreaChart>
Line: stroke={var(--green-primary)}, strokeWidth=2
Fill: <linearGradient> from var(--green-primary) opacity 0.2 → opacity 0
Grid: strokeDasharray="3 3", stroke={var(--border-primary)}
X-Axis: tick={var(--text-tertiary)}, fontSize=12, JetBrains Mono
Y-Axis: tick={var(--text-tertiary)}, fontSize=12, JetBrains Mono, formatted as $XX,XXX
Tooltip: custom component — bg: var(--bg-elevated), border: var(--border-primary), text: var(--text-primary)
Animation: isAnimationActive={true}, animationDuration=800
Responsive: <ResponsiveContainer width="100%" height={400}>
```

### Benchmark Overlay
```
Second <Line> on the same chart
stroke={var(--oak-300)}, strokeWidth=1.5, strokeDasharray="6 4"
No fill
Separate Y-axis (normalized) or same axis if values are comparable
```

### Allocation Donut
```
Component: <PieChart> with <Pie innerRadius={60} outerRadius={100}>
Colors: Generated palette ranging through greens and oaks
Labels: <Label> outside each slice — "{ticker} {%}"
Center: Custom label — total portfolio value
```

### Sector Horizontal Bars
```
Component: <BarChart layout="vertical">
Bars: Fill from green → oak palette
Labels: Sector name on left, percentage on right
```

### Mini Sparklines (dashboard cards)
```
Component: <LineChart> with no axes, no grid, no tooltip
Size: width=120, height=40
Line: strokeWidth=1.5, green if positive overall, red if negative
Data: Last 30 days of portfolio value
```

---

## Responsive Breakpoints

- **Desktop (≥1280px)**: Full layout, multi-column grids, side-by-side charts and tables
- **Tablet (768–1279px)**: 2-column grid for portfolio cards, charts stack above tables
- **Mobile (<768px)**: Single column, horizontal scroll on tables, modals become full-screen sheets, chart height reduced to 250px, hamburger nav

---

## Future-Proofing (Spec'd, Not Built in MVP)

### Supabase Integration
- **Database**: Migrate all Zustand/localStorage data to Supabase Postgres tables: `portfolios`, `holdings`, `lots`, `watchlist_items`, `user_preferences`
- **Auth**: Supabase Auth with email/password + Google OAuth. Protect all pages behind auth middleware.
- **Row-level security**: Each user only sees their own data
- **Realtime**: Use Supabase Realtime subscriptions for live portfolio updates (if multi-device support is needed)

### Auth UI (future)
- Login page with email/password + Google sign-in
- Sign up flow
- Settings page for account management, currency preference, default benchmark

The app should be architected so that swapping localStorage for Supabase is a matter of changing the Zustand persist adapter and adding auth guards — the components and API routes shouldn't need significant changes.

---

## Key UX Details

1. **Loading states**: Skeleton shimmer loaders (pulsing `var(--bg-tertiary)` blocks) on all cards, charts, and table rows while data loads
2. **Empty states**: Meaningful empty states with icon + message + CTA for every section (no portfolios, no holdings, empty watchlist)
3. **Number animations**: Animate portfolio values counting up on load (requestAnimationFrame counter or a lightweight count-up utility)
4. **Toasts**: Bottom-right corner, auto-dismiss after 3s. Green background for success, red for errors. "Portfolio created", "Holding added", "Lot removed", etc.
5. **Confirmation dialogs**: Required before deleting a portfolio, removing a holding, or removing a lot. Dark modal with clear "Cancel" and "Delete" (red) buttons.
6. **Keyboard shortcuts**: Escape closes any modal. Tab navigation through forms.
7. **Number formatting**: All dollar values: `$12,345.67` (with commas). Percentages: `+12.34%` or `-5.67%` (always show sign). Tickers: uppercase. Dates: "Mar 15, 2026" format.
8. **Refresh behavior**: Quotes auto-refresh every 60 seconds. Manual refresh button available. Show "Last updated: 2:35 PM" timestamp.
9. **Offline resilience**: If API calls fail, show last cached data with a subtle "Data may be delayed" banner — don't break the UI.

---

## Development Phases

### Phase 1 — Foundation (build first)
- Project scaffolding (Next.js + Tailwind + TypeScript)
- Design system (CSS variables, theme toggle, typography, UI components)
- Navbar + layout + market overview bar
- Zustand stores with localStorage persistence

### Phase 2 — Core Portfolio Features
- Dashboard page with summary cards and portfolio grid
- Create / delete portfolio flow
- Add holding with ticker search + lot tracking
- Holdings table with sorting and expandable rows
- Portfolio detail page with all sections

### Phase 3 — Charts & Visualization
- Portfolio performance area chart with time range selector
- Benchmark overlay
- Allocation donut chart
- Sector breakdown bars
- Mini sparklines on dashboard cards
- Combined performance chart on dashboard

### Phase 4 — Intelligence Features
- Watchlist page
- News feed integration
- Economic calendar
- AI rebalancing page (mock data acceptable for MVP, Claude API integration ideal)

### Phase 5 — Polish & Future
- Responsive design pass
- Loading skeletons, empty states, error states
- Number animations, micro-interactions
- Currency conversion
- Prep Supabase schema + auth (don't wire up yet)
