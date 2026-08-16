import { apiHandler } from "@/lib/apiHandler";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { BacktestRun } from "@/types/backtest";

// Saved runs are immutable once complete; only the list grows, so a short
// shared cache is plenty.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

const LIMIT = 50;

export const GET = apiHandler("backtest-runs", async () => {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("backtest_runs")
    .select(
      "id,created_at,strategy,params,ticker,market_code,proxy_quality," +
        "start_date,end_date,status,error,code_version,metrics,prompt,spec"
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    throw new Error(`Supabase: ${error.message}`);
  }

  return Response.json((data ?? []) as unknown as BacktestRun[], {
    headers: CACHE_HEADERS,
  });
});
