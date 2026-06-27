import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { WIDGETS, parseGrandPortfolio } from "@/lib/dataroma/grandPortfolio";

const DATAROMA_BASE = "https://www.dataroma.com/m/";
// Dataroma rejects bare/script fetches — present as a normal browser.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};
const DELAY_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST /api/superinvestors/summary/refresh
// Scrapes the five Dataroma grand-portfolio tables and upserts the top 10 of
// each. Per-widget try/catch: a failed widget leaves its cached rows untouched.
export async function POST() {
  const supabase = createServerSupabaseClient();
  const results: Record<string, unknown> = {};
  const now = new Date().toISOString();

  for (const w of WIDGETS) {
    try {
      await sleep(DELAY_MS);
      const res = await fetch(DATAROMA_BASE + w.path, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        results[w.key] = { error: `Dataroma ${res.status}` };
        continue;
      }

      const { quarter, rows } = parseGrandPortfolio(await res.text(), w.metricHeader);
      if (rows.length === 0) {
        results[w.key] = { error: "parsed 0 rows" };
        continue;
      }

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
