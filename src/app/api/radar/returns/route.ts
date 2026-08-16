import { NextRequest, NextResponse } from "next/server";
import { fetchPeriodReturn, RADAR_RETURN_PERIODS } from "@/lib/radar-returns";
import { moversCacheKey } from "@/lib/radar-movers";
import { radarReturnsCache } from "@/lib/cache";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

const VALID_PERIODS = RADAR_RETURN_PERIODS;

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");
  const period = request.nextUrl.searchParams.get("period") ?? "";

  if (!tickersParam) {
    return NextResponse.json(
      { error: "tickers parameter is required" },
      { status: 400 }
    );
  }

  if (!VALID_PERIODS.has(period)) {
    return NextResponse.json(
      { error: "invalid or unsupported period" },
      { status: 400 }
    );
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "at least one ticker is required" },
      { status: 400 }
    );
  }

  const result: Record<string, number> = {};
  const uncached: string[] = [];

  // Serve cached returns; cached `null` means a prior fetch failed — skip it this TTL.
  // Keys are shared with /api/radar/movers, so a ranking pass warms this route.
  for (const ticker of tickers) {
    const cached = radarReturnsCache.get(moversCacheKey(ticker, period));
    if (cached !== undefined) {
      if (cached !== null) result[ticker] = cached;
    } else {
      uncached.push(ticker);
    }
  }

  // Fetch uncached tickers in batches to avoid overwhelming Yahoo Finance.
  const BATCH_SIZE = 20;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (ticker) => {
        const change = await fetchPeriodReturn(ticker, period);
        radarReturnsCache.set(moversCacheKey(ticker, period), change);
        return { ticker, change };
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.change !== null) {
        result[r.value.ticker] = r.value.change;
      }
    }
  }

  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
