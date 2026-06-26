import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DataromaHolding {
  ticker: string;
  company_name: string;
  pct_portfolio: number;
  activity: string; // raw "Recent Activity" text, e.g. "Reduce 9.78%", "Add 3.46%", "Buy"
  shares: number;
  value_usd: number;
}

interface DataromaPortfolio {
  quarter: string;        // e.g. "Q1 2026"
  portfolioDate: string;  // ISO date, e.g. "2026-03-31"
  holdings: DataromaHolding[];
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
const DATAROMA_BASE = "https://www.dataroma.com/m/holdings.php";
// Dataroma rejects bare/script fetches — present as a normal browser.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};
const DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── HTML parsing ──────────────────────────────────────────────────────────────
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8201;?/g, " ")
    .trim();
}

function toNumber(raw: string): number {
  const n = parseFloat(raw.replace(/[$,%\s]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Map Dataroma's "Recent Activity" text to the change_type values the UI expects.
function activityToChangeType(activity: string): string {
  const a = activity.trim().toLowerCase();
  if (a.startsWith("buy")) return "new";
  if (a.startsWith("add")) return "increased";
  if (a.startsWith("reduce")) return "decreased";
  if (a.startsWith("sell")) return "sold";
  return "unchanged";
}

// Convert "31 Mar 2026" → "2026-03-31"
const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};
function parsePortfolioDate(raw: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/.exec(raw);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${day}`;
}

function parseDataromaHoldings(html: string): DataromaPortfolio | null {
  // Header metadata lives in <p id="p2">Period: <span>Q1 2026</span> …
  //   Portfolio date: <span>31 Mar 2026</span> …</p>
  const quarter =
    /Period:\s*<span>([^<]+)<\/span>/i.exec(html)?.[1]?.trim() ?? "";
  const portfolioDateRaw =
    /Portfolio date:\s*<span>([^<]+)<\/span>/i.exec(html)?.[1]?.trim() ?? "";
  const portfolioDate = parsePortfolioDate(portfolioDateRaw);

  if (!quarter || !portfolioDate) return null;

  // Isolate the holdings table body. An empty <tbody></tbody> is valid — it just
  // means the manager reports no holdings this quarter (return [] below, not null).
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1] ?? "";

  const holdings: DataromaHolding[] = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(tbody)) !== null) {
    const row = rowMatch[1];
    if (!/class="stock"/.test(row)) continue;

    // Ticker + company from the stock cell:
    //   <a href="/m/stock.php?sym=TRMD">TRMD<span> - Torm Plc</span></a>
    const stockMatch =
      /sym=([^"&]+)"[^>]*>\s*([^<]+?)\s*<span>\s*-\s*([^<]*)<\/span>/i.exec(row);
    if (!stockMatch) continue;
    const ticker = stockMatch[1].trim();
    const company_name = stripTags(stockMatch[3]).trim();

    // Cells, in order: hist, stock, %, activity, shares, reported price, value, …
    const cells: string[] = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(row)) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length < 7) continue;

    holdings.push({
      ticker,
      company_name,
      pct_portfolio: toNumber(cells[2]),
      activity: cells[3].trim(),
      shares: Math.round(toNumber(cells[4])),
      value_usd: Math.round(toNumber(cells[6])),
    });
  }

  // Header parsed successfully — return even if the manager currently reports
  // zero holdings (e.g. confidential treatment / no 13F this quarter).
  return { quarter, portfolioDate, holdings };
}

// ── POST /api/experts/refresh?manager=marks ───────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const managerId = request.nextUrl.searchParams.get("manager");

  let query = supabase.from("expert_managers").select("*");
  if (managerId) query = query.eq("id", managerId) as typeof query;
  const { data: managers, error: mgErr } = await query;

  if (mgErr) return NextResponse.json({ error: mgErr.message }, { status: 500 });
  if (!managers?.length) return NextResponse.json({ error: "No managers found" }, { status: 404 });

  const results: Record<string, unknown> = {};

  for (const manager of managers) {
    const mid = manager.id as string;
    const code = manager.dataroma_code as string | null;

    if (!code) {
      results[mid] = { error: "No dataroma_code set" };
      continue;
    }

    try {
      // 1. Fetch the manager's holdings page
      await sleep(DELAY_MS);
      const res = await fetch(
        `${DATAROMA_BASE}?m=${encodeURIComponent(code)}`,
        { headers: BROWSER_HEADERS },
      );
      if (!res.ok) {
        results[mid] = { error: `Dataroma ${res.status}` };
        continue;
      }
      const html = await res.text();

      // 2. Parse
      const parsed = parseDataromaHoldings(html);
      if (!parsed) {
        results[mid] = { error: "Failed to parse holdings table" };
        continue;
      }
      const { quarter, portfolioDate, holdings } = parsed;

      if (holdings.length === 0) {
        results[mid] = { status: "no_holdings", quarter };
        continue;
      }

      // 3. Skip if this quarter is already cached
      const { data: existing } = await supabase
        .from("expert_holdings")
        .select("id")
        .eq("manager_id", mid)
        .eq("quarter", quarter)
        .limit(1)
        .maybeSingle();

      if (existing) {
        results[mid] = { status: "already_cached", quarter };
        continue;
      }

      // 4. Build rows
      const rows = holdings.map((h) => ({
        manager_id:       mid,
        quarter,
        period_of_report: portfolioDate,
        filed_date:       portfolioDate,
        cusip:            null,
        ticker:           h.ticker,
        company_name:     h.company_name,
        value_usd:        h.value_usd,
        shares:           h.shares,
        share_class:      null,
        option_type:      null,
        change_type:      activityToChangeType(h.activity),
        shares_prev:      null,
        pct_portfolio:    h.pct_portfolio,
        activity:         h.activity || null,
      }));

      // 5. Upsert in batches
      for (let i = 0; i < rows.length; i += 500) {
        const { error: upErr } = await supabase
          .from("expert_holdings")
          .upsert(rows.slice(i, i + 500), {
            onConflict: "manager_id,quarter,ticker",
          });
        if (upErr) throw new Error(upErr.message);
      }

      // 6. Touch updated_at
      await supabase
        .from("expert_managers")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", mid);

      results[mid] = {
        status: "fetched",
        quarter,
        portfolio_date: portfolioDate,
        holdings_count: holdings.length,
      };
    } catch (err) {
      results[mid] = { error: String(err) };
    }
  }

  return NextResponse.json({ results });
}

// GET version for easy browser / cron triggering
export async function GET(request: NextRequest) {
  return POST(request);
}
