import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// GET /api/experts
// Returns all managers with their latest quarter summary (top 5 holdings, totals).
// Public endpoint — no auth required, data is public SEC info.
export async function GET() {
  const supabase = createServerSupabaseClient();

  // 1. Fetch all managers
  const { data: managers, error: mgErr } = await supabase
    .from("expert_managers")
    .select("*")
    .order("id");

  if (mgErr) return NextResponse.json({ error: mgErr.message }, { status: 500 });
  if (!managers?.length) return NextResponse.json([]);

  // 2. For each manager, get their latest quarter's holdings summary
  const results = await Promise.all(
    managers.map(async (manager) => {
      // Get latest quarter label
      const { data: latestRow } = await supabase
        .from("expert_holdings")
        .select("quarter, period_of_report, filed_date")
        .eq("manager_id", manager.id)
        .order("period_of_report", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestRow) {
        return {
          ...manager,
          latest_quarter: null,
          total_value_usd: 0,
          holdings_count: 0,
          top_holdings: [],
          new_positions: 0,
          filed_date: null,
        };
      }

      const { quarter, filed_date } = latestRow;

      // Get summary stats for latest quarter
      const { data: holdings } = await supabase
        .from("expert_holdings")
        .select("ticker, company_name, value_usd, pct_portfolio, change_type, option_type")
        .eq("manager_id", manager.id)
        .eq("quarter", quarter)
        .is("option_type", null)  // equity only (no options rows)
        .order("value_usd", { ascending: false });

      const rows = holdings ?? [];
      const total_value_usd = rows.reduce((s, r) => s + (r.value_usd ?? 0), 0);
      const new_positions = rows.filter((r) => r.change_type === "new").length;
      const top_holdings = rows.slice(0, 5).map((r) => ({
        ticker: r.ticker,
        company_name: r.company_name,
        pct_portfolio: r.pct_portfolio,
        change_type: r.change_type,
      }));

      return {
        ...manager,
        latest_quarter: quarter,
        filed_date,
        total_value_usd,
        holdings_count: rows.length,
        new_positions,
        top_holdings,
      };
    })
  );

  return NextResponse.json(results, {
    headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
  });
}
