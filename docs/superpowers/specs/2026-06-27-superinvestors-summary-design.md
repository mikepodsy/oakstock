# Superinvestors Page + Market Summary Widgets

**Date:** 2026-06-27
**Status:** Approved (design)
**Area:** `/experts` page (to be relabeled "Superinvestors")

## Goal

1. Rename the "Experts" section to **"Superinvestors"** (labels only — routes/tables unchanged).
2. Add a **Market Summary** section at the top of the page (below the search bar / info banner, above the fund grid) containing five aggregate widgets sourced from Dataroma's grand-portfolio tables:
   - **Top 10 Most Owned** stocks (by # of superinvestors holding)
   - **Top 10 Buys — Last Quarter** (by # of superinvestors buying)
   - **Top 10 Buys — Last 2 Quarters**
   - **Top 10 Sells — Last Quarter** (by # of superinvestors selling)
   - **Top 10 Sells — Last 2 Quarters**

## Data Source

All five widgets come from Dataroma's "grand portfolio" page family. Each URL returns a single ~100-row ranked HTML table; we take the **top 10** rows. Every table exposes the same shape: `Symbol`, `Stock` (company name), `%`, and a **count column** (the key metric), followed by price columns we ignore.

| Widget key | URL (relative to `https://www.dataroma.com/m/`) | Metric column |
|------------|--------------------------------------------------|---------------|
| `most_owned` | `g/portfolio.php?o=c` | Ownership count |
| `buys_1q` | `g/portfolio_b.php?q=q&o=c` | Buys count |
| `buys_2q` | `g/portfolio_b.php?q=h&o=c` | Buys count |
| `sells_1q` | `g/portfolio_s.php?q=q&o=c` | Sells count |
| `sells_2q` | `g/portfolio_s.php?q=h&o=c` | Sells count |

Notes:
- `q=q` = latest quarter, `q=h` = last two quarters (half year). `o=c` = order by count descending.
- Dataroma rejects bare/script fetches; requests must send browser-like headers. Reuse the `BROWSER_HEADERS` and `DELAY_MS` throttle idioms already in `src/app/api/experts/refresh/route.ts`.
- The `most_owned` table has columns `Symbol, Stock, %, Ownership count, Hold Price, Max %, Current Price, ...`; the buys/sells tables have `Symbol, Stock, %, Buys|Sells, Hold Price, Current Price, ...`. The parser locates the count by header label rather than fixed index, so column drift doesn't silently break it.
- A "quarter" label (e.g. "Q1 2026") is scraped from each page header for display; if absent, the widget stores `null` and the UI omits the label.

## Data Layer

**New table `superinvestor_summary`** (one row per widget entry):

| column | type | notes |
|--------|------|-------|
| `id` | uuid / bigint PK | |
| `widget_key` | text | one of the five keys above |
| `rank` | int | 1–10 |
| `ticker` | text | |
| `company_name` | text | |
| `metric` | int | the count (owners / buyers / sellers) |
| `quarter` | text null | label like "Q1 2026" |
| `updated_at` | timestamptz | set on each refresh |

Unique constraint on `(widget_key, rank)` for idempotent upserts. Migration created via Supabase (mirrors how `expert_holdings` was set up).

**New route `POST/GET /api/superinvestors/summary/refresh`:**
- Iterates the five URLs (throttled by `DELAY_MS`), fetches with browser headers, parses the top 10 rows of each.
- Per-URL `try/catch`: a failed fetch/parse **leaves that widget's existing rows intact** (does not wipe), and is reported in the JSON result. Only successfully-parsed widgets are replaced.
- Replace strategy per widget: delete the widget's 10 rows, insert the fresh 10 (or upsert on `(widget_key, rank)`), then stamp `updated_at`.
- GET delegates to POST for easy browser/cron triggering (same pattern as the existing experts refresh).

**New route `GET /api/superinvestors/summary`:**
- Reads all rows, groups by `widget_key`, returns `{ widgets: { most_owned: [...], buys_1q: [...], ... }, quarter, updated_at }`.
- **Staleness handling (auto-refresh):**
  - If the table is **empty** → trigger refresh **synchronously**, then return fresh data.
  - If data is **stale** (`max(updated_at)` older than ~24h) → return cached rows **immediately** and fire the refresh in the **background** (fire-and-forget), so the read path stays fast.
  - If fresh → return cached rows.
- Sets `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` like `GET /api/experts`.

## UI

**Relabel:**
- `src/components/layout/Sidebar.tsx` nav entry label → "Superinvestors".
- `src/app/experts/page.tsx` `<h1>` → "Superinvestors" (subtitle unchanged).

**Market Summary section** — new component, rendered between the info banner and the fund grid in `experts/page.tsx`:
- Collapsible, **default open**. Header bar: title "Market Summary", optional quarter label, chevron toggle (matches the existing options-panel collapse-toggle pattern recently added to the chart).
- Layout (**2×3, Most Owned wider**):
  - Row 1: **Most Owned** as a full-width feature card.
  - Row 2: 2×2 grid — **Buys · Last Qtr**, **Buys · Last 2 Qtrs**, **Sells · Last Qtr**, **Sells · Last 2 Qtrs**. Responsive: collapses to single column on narrow screens.
- Each list row: `rank · TICKER (bold) · company name (truncated, secondary text) · metric badge`.
  - Metric badge text: `"39 own"` / `"19 buy"` / `"24 sell"`.
  - Color accents reuse existing palette: buys emerald, sells red, most-owned neutral (consistent with `ChangeIcon`).
- Rows are **not** clickable in this iteration (tickers don't map to manager pages). Easy to make linkable later.
- **Loading:** skeleton rows matching existing `CardSkeleton` styling.
- **Error/empty:** if the summary API fails or returns empty, the section **hides quietly**; the fund grid below still renders. Summary is additive, never blocking.

## Out of Scope (YAGNI)

- The "by %" variants of the buys/sells tables (only the count-ranked top 10 are requested).
- "Big bets", insider-buys, and 52-week-low tables from Dataroma's home page.
- Renaming routes/folders/DB tables (`/experts`, `expert_managers`, `expert_holdings`).
- Clickable ticker rows / per-stock drill-down.

## Testing

- **Parser unit tests:** feed saved HTML fixtures for each of the 5 URLs; assert top-10 extraction, count parsing, company-name cleanup, and quarter-label extraction. Include a fixture with a missing/empty table to assert graceful handling.
- **Refresh route:** assert per-URL failure isolation (one bad URL doesn't wipe other widgets) and idempotent re-run (re-running produces the same 10 rows, no duplicates).
- **Summary GET:** assert empty→synchronous-refresh, stale→serve-cached-and-background-refresh, fresh→serve-cached.
- **UI:** render with mock data (all widgets), with empty data (section hidden), and loading state (skeletons).
