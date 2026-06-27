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

async function readRows(
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<SummaryDbRow[]> {
  const { data, error } = await supabase
    .from("superinvestor_summary")
    .select("widget_key, rank, ticker, company_name, metric, quarter, updated_at")
    .order("rank", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SummaryDbRow[];
}

// GET /api/superinvestors/summary
// Serves the cached widgets. Refreshes synchronously when empty (first load)
// and in the background when stale (>24h).
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
  // Uses Next 16's `after` (next/server) — the App Router equivalent of
  // waitUntil; survives the response returning on serverless.
  const newest = Math.max(...rows.map((r) => new Date(r.updated_at).getTime()));
  if (Date.now() - newest > STALE_MS) {
    after(async () => {
      await refresh();
    });
  }

  // Group by widget, preserving WIDGETS order.
  const widgets = emptyWidgets();
  for (const r of rows) {
    const key = r.widget_key as WidgetKey;
    if (widgets[key]) {
      widgets[key].push({
        rank: r.rank,
        ticker: r.ticker,
        company_name: r.company_name,
        metric: r.metric,
        quarter: r.quarter,
      });
    }
  }

  // Not every grand-portfolio page prints the quarter label; use whichever has one.
  const quarter = rows.find((r) => r.quarter)?.quarter ?? null;

  return NextResponse.json(
    { quarter, widgets },
    { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
