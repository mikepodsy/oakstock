# Oakstock Options Module — Build Spec

## Overview

Two new pages added to the existing Oakstock Next.js/Supabase app:
1. `/options/[ticker]` — Option Position Builder with live payoff diagram
2. `/options/[ticker]/volatility` — Volatility Dashboard

Data source: Questrade API (OAuth 2.0, already integrated). Greeks calculated client-side using Black-Scholes (`black-scholes` npm package). Charts via whichever charting library is already in the project.

---

## Page 1: Option Position Builder (`/options/[ticker]`)

### Strategy Selector

Dropdown that pre-populates legs automatically when selected:
- Long Call, Long Put
- Covered Call, Cash-Secured Put
- Bull Call Spread, Bear Put Spread
- Bull Put Spread, Bear Call Spread
- Iron Condor, Iron Butterfly
- Straddle, Strangle
- Custom (blank, user adds legs manually)

When a strategy is selected, scaffold the correct legs with action/type pre-filled. User selects expiry and strike for each leg from dropdowns populated via Questrade API.

### Leg Builder

One row per leg:
```
[Buy/Sell] [Call/Put] [Qty] [Expiry dropdown] [Strike dropdown] [Mid price] [remove]
```
- Expiry dropdown: fetch available expirations from Questrade options chain endpoint
- Strike dropdown: populates based on selected expiry
- Mid price: auto-filled from `(bid + ask) / 2`
- Add Leg button for custom strategies
- Underlying price: auto-fetched from Questrade, editable
- IV override toggle: when on, user can manually set IV% per leg instead of using market IV
- DTE shown automatically per leg

### Payoff Diagram

X-axis: underlying price range (±30% from current price, 100 data points)
Y-axis: P&L in dollars

Three curves:
- **Expiry P&L** — intrinsic value only, solid line, always shown
- **Today P&L** — BS-priced at current date, dashed line, shown by default
- **Intermediate dates** — togglable, faded lines at 25%, 50%, 75% of DTE elapsed

Time decay slider: drag from today → expiration. Today P&L curve updates live. Current selected date shown as label.

Overlays (each toggleable):
- ±1σ expected move band — vertical shaded region, calculated as `ATM IV × sqrt(DTE/365)`
- ±2σ band
- Current underlying price — vertical dotted line
- Breakeven points — labeled dots on x-axis

Hover tooltip: exact P&L at hovered underlying price for each curve. Click to pin a price and see all leg values at that point.

### Position Summary

Stats:
```
Max Profit:       $X  (or Unlimited)
Max Loss:         $X  (or Unlimited)
Breakeven(s):     $X [, $Y]
Net Debit/Credit: $X
Win Rate:         X%  (% of expiry price outcomes that are profitable, derived from IV-implied distribution)
```

Net Greeks (summed across all legs, position-weighted):
```
Delta:   X.XX
Theta:  -X.XX  (per day)
Gamma:   X.XX
Vega:    X.XX
Rho:     X.XX
```

Per-leg greeks table (collapsible):
Columns: Leg | Delta | Gamma | Theta | Vega | IV% | Mid

Share button: encodes full position into URL params (ticker, legs, strikes, expiries, qty, action) so the position is bookmarkable and shareable via URL.

### Data Flow

```
1. User selects ticker → fetch current quote from Questrade
2. User selects strategy → scaffold legs
3. User selects expiry per leg → fetch options chain for that expiry from Questrade
4. Strike dropdown populates → user selects strike → mid price auto-fills from chain
5. On any change → recalculate:
   a. BS price for each leg at each of the 100 underlying price points
   b. Sum P&L across all legs at each price point
   c. Recalculate net greeks
   d. Redraw chart
```

BS inputs per leg:
- S = current underlying price (live or from slider)
- K = strike
- T = DTE / 365
- r = 0.045 (hardcoded risk-free rate)
- σ = IV from chain data, or user override

---

## Page 2: Volatility Dashboard (`/options/[ticker]/volatility`)

Four sections on one scrollable page. Ticker search at top.

### Section 1 — IV Percentile & VRP

Stat cards:
```
IV Rank:        XX%   (current IV vs 52-week high/low range)
IV Percentile:  XX%   (% of past 252 trading days where IV was below today's level)
```

Chart — IV vs HV30 over trailing 252 trading days:
- Line 1: 30-day implied vol (ATM IV, daily)
- Line 2: 30-day realized/historical vol (close-to-close)
- Shaded area between them = VRP. Green when IV > HV (premium sellers favored). Red when HV > IV.
- Hover tooltip showing IV, HV, and VRP spread on any date

VRP stat cards:
```
Current VRP:    +X.X%   (IV30 minus HV30)
Avg VRP (1yr):  +X.X%
VRP Percentile:  XX%
```

Data persistence: on each page load, write today's ATM IV and HV30 to Supabase `iv_history` table if today's row doesn't already exist for that ticker. HV30 is calculated from Questrade OHLCV daily data.

### Section 2 — Term Structure

Chart — ATM IV by expiration:
- X-axis: days to expiry for each available expiration
- Y-axis: ATM IV%
- Line connecting each expiry's ATM IV
- Dot marker per expiry labeled with date
- Optional overlay: term structure from 1 week ago and 1 month ago, pulled from Supabase `iv_history`
- Hover: IV%, DTE, expiry date

Auto-flags:
- If term structure is inverted (front IV > back IV), label "Backwardation" in orange
- If front-month IV exceeds back-month by more than 5%, label "Elevated Front Vol"

### Section 3 — Skew Structure

Chart — IV by strike for a selected expiry:
- Expiry selector dropdown, defaults to front month
- X-axis: strike price. Toggle to switch to delta on x-axis.
- Y-axis: IV%
- Markers at 25-delta put, ATM, 25-delta call — labeled
- Vertical dotted line at current underlying price
- Optional second expiry overlay toggle to compare skew shape across expirations

Skew stats:
```
Put Skew (25d):   XX%   (25d put IV minus ATM IV)
Call Skew (25d):  XX%   (25d call IV minus ATM IV)
Risk Reversal:    XX%   (25d put IV minus 25d call IV — positive = put skew / downside fear)
```

### Section 4 — IV vs Recent History

Gauge or bar showing where current ATM IV sits relative to:
- 30-day average IV
- 90-day average IV
- 52-week high and low

Colored zones: low/cheap vol → average → elevated/expensive

Table:
```
Period        | Avg IV | Current IV | vs Avg
--------------|--------|------------|--------
30-day avg    |  XX%   |    XX%     |  +X%
90-day avg    |  XX%   |    XX%     |  +X%
52-week high  |  XX%   |    —       |   —
52-week low   |  XX%   |    —       |   —
```

---

## Supabase Table

```sql
CREATE TABLE iv_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  date DATE NOT NULL,
  iv30 NUMERIC,
  hv30 NUMERIC,
  iv_rank NUMERIC,
  iv_percentile NUMERIC,
  term_structure JSONB,
  skew JSONB,
  UNIQUE(ticker, date)
);
```

---

## npm Packages

```bash
npm install black-scholes
npm install date-fns
```

---

## Implementation Notes

- Questrade options chain endpoint: `GET /v1/markets/options` with `underlyingId`, `expiryDate`, `optionType` params
- ATM IV = IV of the strike closest to current underlying price at each expiry
- HV30 = annualized standard deviation of log returns over past 30 trading days from daily close prices: `sqrt(252) × stddev(ln(close_t / close_t-1))`
- All BS calculations run client-side — no server compute needed
- Greeks sign convention: long call = positive delta, long put = negative delta, theta always negative for long positions
- Win rate = probability that underlying price at expiry falls in the profitable zone, derived from log-normal distribution using current ATM IV
- The `iv_history` table is written once per day per ticker on first page load — check for existing row before inserting
- Position share URL format: encode ticker, and for each leg encode action/type/expiry/strike/qty as query params
