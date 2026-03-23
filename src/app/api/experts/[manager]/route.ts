import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// GET /api/experts/[manager]?quarter=Q4+2024
// Returns full holdings + QoQ comparison for a specific manager.
export async function GET(
  request: NextRequest,
  { params }: { params: { manager: string } }
) {
  const supabase = createServerSupabaseClient();
  const managerId = params.manager;
  const requestedQuarter = request.nextUrl.searchParams.get("quarter");

  // 1. Get manager info
  const { data: manager, error: mgErr } = await supabase
    .from("expert_managers")
    .select("*")
    .eq("id", managerId)
    .maybeSingle();

  if (mgErr) return NextResponse.json({ error: mgErr.message }, { status: 500 });
  if (!manager) return NextResponse.json({ error: "Manager not found" }, { status: 404 });

  // 2. Get available quarters (sorted newest first)
  const { data: quarters } = await supabase
    .from("expert_holdings")
    .select("quarter, period_of_report, filed_date")
    .eq("manager_id", managerId)
    .order("period_of_report", { ascending: false });

  const uniqueQuarters = Array.from(
    new Map(quarters?.map((q) => [q.quarter, q]) ?? []).values()
  );

  if (!uniqueQuarters.length) {
    return NextResponse.json({ manager, quarters: [], holdings: [], prev_holdings: [] });
  }

  const activeQuarter = requestedQuarter ?? uniqueQuarters[0].quarter;
  const prevQuarterMeta = uniqueQuarters.find((q) => q.quarter !== activeQuarter);
  const prevQuarter = prevQuarterMeta?.quarter ?? null;

  // 3. Fetch current quarter holdings (equity + options separated)
  const { data: holdings, error: hErr } = await supabase
    .from("expert_holdings")
    .select("*")
    .eq("manager_id", managerId)
    .eq("quarter", activeQuarter)
    .order("value_usd", { ascending: false });

  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

  // 4. Fetch previous quarter for comparison (share counts for % change calc)
  let prev_holdings: Record<string, number> = {};
  if (prevQuarter) {
    const { data: prevRows } = await supabase
      .from("expert_holdings")
      .select("cusip, shares, option_type, value_usd")
      .eq("manager_id", managerId)
      .eq("quarter", prevQuarter);

    for (const row of prevRows ?? []) {
      const key = `${row.cusip}__${row.option_type ?? "equity"}`;
      prev_holdings[key] = row.shares;
    }
  }

  // 5. Compute sector breakdown (by company_name grouping — rough)
  const equityHoldings = (holdings ?? []).filter((h) => !h.option_type);
  const totalValue = equityHoldings.reduce((s, h) => s + (h.value_usd ?? 0), 0);

  // 6. Build stats
  const stats = {
    total_value_usd: totalValue,
    holdings_count: equityHoldings.length,
    new_positions: equityHoldings.filter((h) => h.change_type === "new").length,
    increased_positions: equityHoldings.filter((h) => h.change_type === "increased").length,
    decreased_positions: equityHoldings.filter((h) => h.change_type === "decreased").length,
    unchanged_positions: equityHoldings.filter((h) => h.change_type === "unchanged").length,
    quarter: activeQuarter,
    filed_date: uniqueQuarters.find((q) => q.quarter === activeQuarter)?.filed_date,
  };

  return NextResponse.json(
    {
      manager,
      quarters: uniqueQuarters.map((q) => q.quarter),
      active_quarter: activeQuarter,
      prev_quarter: prevQuarter,
      holdings: holdings ?? [],
      prev_holdings,
      stats,
    },
    {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
    }
  );
}
