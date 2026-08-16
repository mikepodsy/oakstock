import { ApiError, apiHandler } from "@/lib/apiHandler";
import { createServerSupabaseClient } from "@/lib/supabase";
import type {
  BacktestDetail,
  BacktestRun,
  BacktestTrade,
  EquityPoint,
} from "@/types/backtest";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

// PostgREST enforces a server-side max-rows cap (1000 by default) that a
// `.limit()` cannot raise — it silently truncates instead of erroring. A 4-year
// daily run is already 1004 points, and a 15-year backfill is ~3800, so the
// curve must be read in explicit pages or the chart quietly loses its tail.
const PAGE_SIZE = 1000;
const MAX_PAGES = 40;

async function fetchAllEquity(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  runId: string
): Promise<EquityPoint[]> {
  const out: EquityPoint[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("backtest_equity")
      .select("date,equity,benchmark_equity,drawdown,exposure,position")
      .eq("run_id", runId)
      .order("date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Supabase: ${error.message}`);
    const batch = (data ?? []) as unknown as EquityPoint[];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return out;
}

export const GET = apiHandler(
  "backtest-run",
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const supabase = createServerSupabaseClient();

    const [runRes, equity, tradesRes] = await Promise.all([
      supabase.from("backtest_runs").select("*").eq("id", id).maybeSingle(),
      fetchAllEquity(supabase, id),
      supabase
        .from("backtest_trades")
        .select("*")
        .eq("run_id", id)
        .order("entry_date", { ascending: true }),
    ]);

    if (runRes.error) throw new Error(`Supabase: ${runRes.error.message}`);
    if (!runRes.data) throw new ApiError(404, "Backtest run not found");
    if (tradesRes.error) throw new Error(`Supabase: ${tradesRes.error.message}`);

    const detail: BacktestDetail = {
      run: runRes.data as unknown as BacktestRun,
      equity,
      trades: (tradesRes.data ?? []) as unknown as BacktestTrade[],
    };

    return Response.json(detail, { headers: CACHE_HEADERS });
  }
);
