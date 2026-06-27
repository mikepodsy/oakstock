# Superinvestors Summary Widgets Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. This project has **no test framework** (no jest/vitest, zero test files); per existing convention, verification is done via `npm run lint`, `npm run build`, and `curl` against the running dev server — do NOT introduce a test runner.

**Goal:** Rename the "Experts" section to "Superinvestors" and add a collapsible Market Summary section with five Dataroma-sourced aggregate widgets (Most Owned, Buys 1Q/2Q, Sells 1Q/2Q).

**Architecture:** A new `superinvestor_summary` Supabase table caches the top-10 rows of each of five Dataroma grand-portfolio tables. A refresh API route scrapes and upserts them (reusing the existing experts-refresh scraping idioms). A read API route serves grouped widgets with stale-while-revalidate caching and triggers refresh when empty (sync) or stale (background via `after`). A new `MarketSummary` client component renders the widgets above the existing fund grid.

**Tech Stack:** Next.js 16 (App Router, `after` from `next/server`), React 19, Supabase (`@supabase/supabase-js` service-role client), Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-27-superinvestors-summary-design.md`

---

## File Structure

- Create: `supabase/superinvestor_summary.sql` — table + index migration
- Create: `src/lib/dataroma/grandPortfolio.ts` — pure parser + widget config (fetch-agnostic, unit-verifiable)
- Create: `src/app/api/superinvestors/summary/refresh/route.ts` — scrape + upsert
- Create: `src/app/api/superinvestors/summary/route.ts` — read + staleness-driven refresh
- Create: `src/app/experts/MarketSummary.tsx` — client component (section + widgets)
- Modify: `src/app/experts/page.tsx` — `<h1>` label + mount `<MarketSummary />`
- Modify: `src/components/layout/Sidebar.tsx:42` — nav label

Routes/folders/tables keep their `experts`/`expert_*` names (per spec: labels only).

**Prerequisite for verification:** Tasks 3, 4, and 6 curl the dev server — start `npm run dev` in a separate shell first. The spec's "Testing" section lists parser/route/UI tests; this repo has no test runner, so those are satisfied by the fixture check (Task 2 Step 2) + lint + build + curl per project convention.

---

## Chunk 1: Data layer (migration + parser + refresh route)

### Task 1: Database migration

**Files:**
- Create: `supabase/superinvestor_summary.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Superinvestors Market Summary: caches the top-10 rows of five Dataroma
-- grand-portfolio tables (most owned / buys 1Q,2Q / sells 1Q,2Q).
-- Populated by POST /api/superinvestors/summary/refresh, read by
-- GET /api/superinvestors/summary. Applied to the `oakstock` Supabase project.

CREATE TABLE IF NOT EXISTS public.superinvestor_summary (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_key   text NOT NULL,           -- most_owned | buys_1q | buys_2q | sells_1q | sells_2q
  rank         int  NOT NULL,           -- 1..10
  ticker       text NOT NULL,
  company_name text NOT NULL,
  metric       int  NOT NULL,           -- count of superinvestors (owning / buying / selling)
  quarter      text,                    -- label e.g. "Q1 2026", nullable
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Upsert conflict target: exactly 10 rows per widget, replaced in place.
CREATE UNIQUE INDEX IF NOT EXISTS superinvestor_summary_widget_rank_key
  ON public.superinvestor_summary (widget_key, rank);

-- Public data, server-only access via service-role key (bypasses RLS).
ALTER TABLE public.superinvestor_summary ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply the migration** to the `oakstock` Supabase project (via Supabase MCP `apply_migration` named `superinvestor_summary`, or paste into the SQL editor). Verify the table exists with `list_tables`.

- [ ] **Step 3: Commit**

```bash
git add supabase/superinvestor_summary.sql
git commit -m "feat(superinvestors): add summary cache table migration"
```

---

### Task 2: Grand-portfolio parser + widget config

**Files:**
- Create: `src/lib/dataroma/grandPortfolio.ts`

The parser is pure (HTML string in → rows out) so it can be checked with a saved fixture. It locates the metric column by **header label** (not fixed index), since the most-owned table has an extra `Max %` column the buys/sells tables lack.

- [ ] **Step 1: Write the module**

```ts
// Pure parser + config for Dataroma's "grand portfolio" aggregate tables.
// No fetching here — keeps it trivially testable and reusable.

export type WidgetKey =
  | "most_owned"
  | "buys_1q"
  | "buys_2q"
  | "sells_1q"
  | "sells_2q";

export interface WidgetConfig {
  key: WidgetKey;
  title: string;
  /** path relative to https://www.dataroma.com/m/ */
  path: string;
  /** header label of the metric/count column on that page */
  metricHeader: string;
  /** short verb for the count badge, e.g. "own" / "buy" / "sell" */
  metricVerb: string;
}

export const WIDGETS: WidgetConfig[] = [
  { key: "most_owned", title: "Most Owned",        path: "g/portfolio.php?o=c",        metricHeader: "Ownership", metricVerb: "own"  },
  { key: "buys_1q",    title: "Buys · Last Qtr",    path: "g/portfolio_b.php?q=q&o=c",  metricHeader: "Buys",      metricVerb: "buy"  },
  { key: "buys_2q",    title: "Buys · Last 2 Qtrs", path: "g/portfolio_b.php?q=h&o=c",  metricHeader: "Buys",      metricVerb: "buy"  },
  { key: "sells_1q",   title: "Sells · Last Qtr",   path: "g/portfolio_s.php?q=q&o=c",  metricHeader: "Sells",     metricVerb: "sell" },
  { key: "sells_2q",   title: "Sells · Last 2 Qtrs",path: "g/portfolio_s.php?q=h&o=c",  metricHeader: "Sells",     metricVerb: "sell" },
];

export interface SummaryRow {
  rank: number;
  ticker: string;
  company_name: string;
  metric: number;
}

export interface ParsedTable {
  quarter: string | null;
  rows: SummaryRow[];
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#9660;?/g, "")  // sort-arrow glyph in header cells
    .replace(/\s+/g, " ")
    .trim();
}

function toInt(raw: string): number {
  const n = parseInt(raw.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse a Dataroma grand-portfolio page. Returns the top `limit` rows.
 * Columns are located by matching the header row labels, so an extra
 * column (e.g. most-owned's "Max %") doesn't shift the metric index.
 */
export function parseGrandPortfolio(
  html: string,
  metricHeader: string,
  limit = 10,
): ParsedTable {
  const quarter =
    /\bQ[1-4]\s+\d{4}\b/.exec(stripTags(html.slice(0, 8000)))?.[0] ?? null;

  const rows: SummaryRow[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;

  // First locate the header row and resolve column indices.
  let symbolIdx = -1, stockIdx = -1, metricIdx = -1;
  const all: string[][] = [];
  while ((m = trRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (c) => stripTags(c[1]),
    );
    if (cells.length) all.push(cells);
  }

  const headerRow = all.find((r) =>
    r.some((c) => /^symbol$/i.test(c)),
  );
  if (headerRow) {
    symbolIdx = headerRow.findIndex((c) => /^symbol$/i.test(c));
    stockIdx = headerRow.findIndex((c) => /^stock$/i.test(c));
    metricIdx = headerRow.findIndex((c) =>
      c.toLowerCase().startsWith(metricHeader.toLowerCase()),
    );
  }
  if (symbolIdx < 0 || metricIdx < 0) return { quarter, rows: [] };

  for (const cells of all) {
    if (cells === headerRow) continue;
    const ticker = cells[symbolIdx]?.trim();
    // data rows have a ticker symbol in the symbol column
    if (!ticker || !/^[A-Z][A-Z0-9.\-]*$/.test(ticker)) continue;
    rows.push({
      rank: rows.length + 1,
      ticker,
      company_name: stockIdx >= 0 ? (cells[stockIdx] ?? "").trim() : "",
      metric: toInt(cells[metricIdx] ?? ""),
    });
    if (rows.length >= limit) break;
  }

  return { quarter, rows };
}
```

- [ ] **Step 2: Verify the parser against a real fixture**

Save a live page and run the parser through `tsx`/`node`:

```bash
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" \
  "https://www.dataroma.com/m/g/portfolio.php?o=c" > /tmp/most_owned.html
npx tsx -e "import {parseGrandPortfolio} from './src/lib/dataroma/grandPortfolio'; import {readFileSync} from 'fs'; console.log(JSON.stringify(parseGrandPortfolio(readFileSync('/tmp/most_owned.html','utf8'),'Ownership'),null,2))"
```

Expected: `quarter` like `"Q1 2026"` and 10 rows, row 1 ≈ `{rank:1, ticker:"GOOGL", company_name:"Alphabet Inc.", metric:39}` (numbers will vary by quarter). Repeat for one buys and one sells URL (metricHeader "Buys" / "Sells") to confirm column-by-label resolution.

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git add src/lib/dataroma/grandPortfolio.ts
git commit -m "feat(superinvestors): add Dataroma grand-portfolio parser"
```

---

### Task 3: Refresh route

**Files:**
- Create: `src/app/api/superinvestors/summary/refresh/route.ts`

Reuses the browser-header + throttle idioms from `src/app/api/experts/refresh/route.ts`. Per-widget try/catch: a failed widget leaves its cached rows untouched.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { WIDGETS, parseGrandPortfolio } from "@/lib/dataroma/grandPortfolio";

const DATAROMA_BASE = "https://www.dataroma.com/m/";
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};
const DELAY_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST() {
  const supabase = createServerSupabaseClient();
  const results: Record<string, unknown> = {};
  const now = new Date().toISOString();

  for (const w of WIDGETS) {
    try {
      await sleep(DELAY_MS);
      const res = await fetch(DATAROMA_BASE + w.path, { headers: BROWSER_HEADERS });
      if (!res.ok) { results[w.key] = { error: `Dataroma ${res.status}` }; continue; }

      const { quarter, rows } = parseGrandPortfolio(await res.text(), w.metricHeader);
      if (rows.length === 0) { results[w.key] = { error: "parsed 0 rows" }; continue; }

      const records = rows.map((r) => ({
        widget_key: w.key,
        rank: r.rank,
        ticker: r.ticker,
        company_name: r.company_name,
        metric: r.metric,
        quarter,
        updated_at: now,
      }));

      const { error } = await supabase
        .from("superinvestor_summary")
        .upsert(records, { onConflict: "widget_key,rank" });
      if (error) throw new Error(error.message);

      results[w.key] = { status: "fetched", rows: rows.length, quarter };
    } catch (err) {
      results[w.key] = { error: String(err) };
    }
  }

  return NextResponse.json({ results });
}

// GET delegates to POST for easy browser/cron triggering.
export async function GET() {
  return POST();
}
```

- [ ] **Step 2: Verify against the dev server**

```bash
npm run dev   # in another shell
curl -s "http://localhost:3000/api/superinvestors/summary/refresh" | python3 -m json.tool
```

Expected: each of the five keys reports `{"status":"fetched","rows":10,...}`. Then confirm 50 rows landed:
verify via Supabase MCP `execute_sql`: `select widget_key, count(*) from superinvestor_summary group by widget_key;` → 5 rows × 10.

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git add src/app/api/superinvestors/summary/refresh/route.ts
git commit -m "feat(superinvestors): add summary refresh route"
```

---

## Chunk 2: Read route + UI + relabel

### Task 4: Read route with staleness-driven refresh

**Files:**
- Create: `src/app/api/superinvestors/summary/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { after, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { WidgetKey, SummaryRow } from "@/lib/dataroma/grandPortfolio";
import { POST as refresh } from "./refresh/route";

const STALE_MS = 24 * 60 * 60 * 1000; // 24h

type WidgetRow = SummaryRow & { quarter: string | null };
type SummaryDbRow = WidgetRow & { widget_key: string; updated_at: string };

function emptyWidgets(): Record<WidgetKey, WidgetRow[]> {
  return { most_owned: [], buys_1q: [], buys_2q: [], sells_1q: [], sells_2q: [] };
}

async function readRows(supabase: ReturnType<typeof createServerSupabaseClient>) {
  const { data, error } = await supabase
    .from("superinvestor_summary")
    .select("widget_key, rank, ticker, company_name, metric, quarter, updated_at")
    .order("rank", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SummaryDbRow[];
}

export async function GET() {
  const supabase = createServerSupabaseClient();

  let rows: SummaryDbRow[];
  try {
    rows = await readRows(supabase);
    // Empty → refresh synchronously and re-read ONCE (no recursion: if refresh
    // populated nothing — e.g. Dataroma down — we fall through and return an
    // empty-but-valid payload so the UI hides quietly instead of looping).
    if (rows.length === 0) {
      await refresh();
      rows = await readRows(supabase);
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ quarter: null, widgets: emptyWidgets() });
  }

  // Stale (freshest widget older than 24h) → serve cached, refresh in background.
  // Uses Next 16's `after` (next/server) — the App Router equivalent of the
  // spec's `waitUntil`; survives the response returning on serverless.
  const newest = Math.max(...rows.map((r) => new Date(r.updated_at).getTime()));
  if (Date.now() - newest > STALE_MS) {
    after(async () => { await refresh(); });
  }

  // Group by widget, preserving WIDGETS order.
  const widgets = emptyWidgets();
  for (const r of rows) {
    const key = r.widget_key as WidgetKey;
    if (widgets[key]) {
      widgets[key].push({
        rank: r.rank, ticker: r.ticker, company_name: r.company_name,
        metric: r.metric, quarter: r.quarter,
      });
    }
  }

  const quarter =
    rows.find((r) => r.widget_key === "buys_1q")?.quarter ?? null;

  return NextResponse.json(
    { quarter, widgets },
    { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
```

- [ ] **Step 2: Verify**

```bash
curl -s "http://localhost:3000/api/superinvestors/summary" | python3 -m json.tool | head -40
```

Expected: `{ "quarter": "Q1 2026", "widgets": { "most_owned": [10 rows], ... } }`. (With the table already seeded from Task 3, this serves cached data and does not block.)

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git add src/app/api/superinvestors/summary/route.ts
git commit -m "feat(superinvestors): add summary read route with stale refresh"
```

---

### Task 5: MarketSummary component

**Files:**
- Create: `src/app/experts/MarketSummary.tsx`

Collapsible (default open), 2×3 layout: Most Owned wide on top, then a 2×2 grid of Buys/Sells. Reuses the page's existing Tailwind tokens (`bg-bg-secondary`, `border-border-primary`, `text-text-*`, emerald/red accents). Hides quietly on error/empty.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface Row {
  rank: number;
  ticker: string;
  company_name: string;
  metric: number;
}
type WidgetKey = "most_owned" | "buys_1q" | "buys_2q" | "sells_1q" | "sells_2q";
interface SummaryResponse {
  quarter: string | null;
  widgets: Record<WidgetKey, Row[]>;
}

const META: Record<WidgetKey, { title: string; verb: string; tone: "neutral" | "buy" | "sell" }> = {
  most_owned: { title: "Most Owned",         verb: "own",  tone: "neutral" },
  buys_1q:    { title: "Buys · Last Qtr",     verb: "buy",  tone: "buy" },
  buys_2q:    { title: "Buys · Last 2 Qtrs",  verb: "buy",  tone: "buy" },
  sells_1q:   { title: "Sells · Last Qtr",    verb: "sell", tone: "sell" },
  sells_2q:   { title: "Sells · Last 2 Qtrs", verb: "sell", tone: "sell" },
};

const TONE: Record<"neutral" | "buy" | "sell", string> = {
  neutral: "text-text-secondary bg-bg-tertiary",
  buy: "text-emerald-500 bg-emerald-500/10",
  sell: "text-red-400 bg-red-400/10",
};

function WidgetCard({ k, rows }: { k: WidgetKey; rows: Row[] }) {
  const meta = META[k];
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4">
      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-3">{meta.title}</p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.rank} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-text-tertiary text-xs w-4 shrink-0 text-right">{r.rank}</span>
              <span className="text-text-primary text-xs font-semibold shrink-0">{r.ticker}</span>
              <span className="text-text-secondary text-xs truncate">{r.company_name}</span>
            </div>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${TONE[meta.tone]}`}>
              {r.metric} {meta.verb}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketSummary() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetch("/api/superinvestors/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SummaryResponse) => {
        if (d?.widgets && Object.values(d.widgets).some((w) => w.length)) setData(d);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  // Summary is additive — hide quietly until data is present.
  if (failed || !data) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 mb-3 text-text-primary font-semibold text-sm"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
        Market Summary
        {data.quarter && <span className="text-text-tertiary font-normal">· {data.quarter}</span>}
      </button>

      {open && (
        <div className="space-y-4">
          <WidgetCard k="most_owned" rows={data.widgets.most_owned} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WidgetCard k="buys_1q" rows={data.widgets.buys_1q} />
            <WidgetCard k="buys_2q" rows={data.widgets.buys_2q} />
            <WidgetCard k="sells_1q" rows={data.widgets.sells_1q} />
            <WidgetCard k="sells_2q" rows={data.widgets.sells_2q} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint** (`npm run lint`). Visual verification happens in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/app/experts/MarketSummary.tsx
git commit -m "feat(superinvestors): add MarketSummary widgets component"
```

---

### Task 6: Relabel + mount

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:42`
- Modify: `src/app/experts/page.tsx`

- [ ] **Step 1: Sidebar label** — change `label: "Experts"` to `label: "Superinvestors"` on line 42.

- [ ] **Step 2: Page heading** — in `src/app/experts/page.tsx`, change `<h1 ...>Experts</h1>` to `Superinvestors`. Leave the subtitle and the "via Dataroma" text unchanged.

- [ ] **Step 3: Mount the component** — import it at the top of `page.tsx`:

```tsx
import { MarketSummary } from "./MarketSummary";
```

and render it inside the scrollable area, **after** the header `</div>` (the block containing the search bar + info banner) and **before** the `{/* Grid */}` block. The natural spot is the start of the `flex-1 px-6 pb-6` grid container — wrap so the summary sits above the grid:

```tsx
{/* Grid */}
<div className="flex-1 px-6 pb-6">
  <MarketSummary />
  {error ? (
    ...
```

- [ ] **Step 4: Verify end-to-end**

```bash
npm run lint && npm run build
```

Then with `npm run dev` running, load `http://localhost:3000/experts`:
- Sidebar shows "Superinvestors"; page `<h1>` shows "Superinvestors".
- Market Summary section renders (default open), Most Owned wide on top, 2×2 Buys/Sells grid below, collapse chevron toggles it.
- Fund cards still render below.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/app/experts/page.tsx
git commit -m "feat(superinvestors): rename Experts and mount Market Summary"
```

---

## Final: open PR

- [ ] Confirm `src/proxy.ts` is NOT staged in any commit (guest-access WIP must stay uncommitted).
- [ ] Push the branch and open a PR to `main` summarizing: rename + five summary widgets + new table/routes; note the migration must be applied to the `oakstock` Supabase project.
