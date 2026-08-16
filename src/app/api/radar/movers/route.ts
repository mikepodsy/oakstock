import { NextRequest, NextResponse } from "next/server";
import { computeMovers } from "@/lib/radar-movers";
import { fetchPeriodReturn, RADAR_RETURN_PERIODS } from "@/lib/radar-returns";
import { radarReturnsCache } from "@/lib/cache";
import { RADAR_SECTORS, RADAR_RANKING_LIMIT } from "@/utils/constants";

// A cold full-universe pass is ~1,500 chart calls. Each request works for
// BUDGET_MS and returns what it resolved; the client re-requests while the
// response is incomplete, so the ranking converges instead of timing out.
export const maxDuration = 60;

const BUDGET_MS = 20_000;
const CONCURRENCY = 32;

// Incomplete passes must not be cached — they're a partial ranking by design.
const COMPLETE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};
const PARTIAL_HEADERS = { "Cache-Control": "no-store" };

// GET /api/radar/movers?sector=all&direction=gainers&period=1w
// Ranks a Radar sector by each ticker's actual return over the period. Yahoo
// only screens by *today's* move, so period rankings have to be computed here.
export async function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get("sector") ?? "";
  const direction = req.nextUrl.searchParams.get("direction") ?? "gainers";
  const period = req.nextUrl.searchParams.get("period") ?? "";
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit")) || RADAR_RANKING_LIMIT,
    RADAR_RANKING_LIMIT
  );

  if (!RADAR_SECTORS[sector]) {
    return NextResponse.json({ error: "Unknown sector" }, { status: 400 });
  }
  if (direction !== "gainers" && direction !== "losers") {
    return NextResponse.json({ error: "Unknown direction" }, { status: 400 });
  }
  if (!RADAR_RETURN_PERIODS.has(period)) {
    return NextResponse.json(
      { error: "invalid or unsupported period" },
      { status: 400 }
    );
  }

  try {
    const result = await computeMovers({
      universe: RADAR_SECTORS[sector].tickers,
      period,
      direction,
      limit,
      cache: radarReturnsCache,
      fetchReturn: fetchPeriodReturn,
      concurrency: CONCURRENCY,
      budgetMs: BUDGET_MS,
    });

    return NextResponse.json(result, {
      headers: result.complete ? COMPLETE_HEADERS : PARTIAL_HEADERS,
    });
  } catch (err) {
    console.error("[radar/movers] failed:", err);
    return NextResponse.json(
      { error: "Failed to rank movers" },
      { status: 502, headers: PARTIAL_HEADERS }
    );
  }
}
