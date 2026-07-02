import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { CrossState } from "@/utils/momentum";
import type { StoredMomentum, Sp400Response } from "@/app/api/alerts/sp400/route";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

interface Row {
  ticker: string;
  name: string | null;
  market_cap: number | null;
  close: number | null;
  sma50: number | null;
  sma200: number | null;
  distance50_pct: number | null;
  distance200_pct: number | null;
  price_vs50: CrossState;
  price_vs200: CrossState;
  cross50v200: CrossState;
  updated_at: string;
}

// Reads the precomputed ETF momentum snapshot, largest fund (AUM) first. Same
// shape as /api/alerts/sp400 so the client can share the snapshot hook.
export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("etf_momentum_status")
    .select(
      "ticker, name, market_cap, close, sma50, sma200, distance50_pct, distance200_pct, price_vs50, price_vs200, cross50v200, updated_at"
    )
    .order("market_cap", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to read ETF momentum status", detail: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as Row[];
  const statuses: StoredMomentum[] = rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    marketCap: r.market_cap,
    close: r.close ?? 0,
    sma50: r.sma50,
    sma200: r.sma200,
    distance50Pct: r.distance50_pct ?? 0,
    distance200Pct: r.distance200_pct ?? 0,
    priceVs50: r.price_vs50,
    priceVs200: r.price_vs200,
    cross50v200: r.cross50v200,
  }));

  const lastUpdated = rows.reduce<string | null>((max, r) => {
    return !max || r.updated_at > max ? r.updated_at : max;
  }, null);

  return NextResponse.json({ statuses, lastUpdated } satisfies Sp400Response, {
    headers: CACHE_HEADERS,
  });
}
