import { NextRequest, NextResponse } from "next/server";
import { etfHoldingsCache } from "@/lib/cache";
import { getEtfHoldings, type EtfHoldingsResult } from "@/lib/edgar/nport";
import { ApiError, apiHandler } from "@/lib/apiHandler";

// NPORT-P holdings change only quarterly, so cache aggressively.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
};

export const GET = apiHandler("etf-holdings", async (request: NextRequest) => {
  const ticker = request.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    throw new ApiError(400, "ticker parameter is required");
  }

  const key = ticker.toUpperCase();
  const cached = etfHoldingsCache.get(key) as EtfHoldingsResult | null | undefined;
  if (cached !== undefined) {
    if (cached === null) {
      throw new ApiError(404, `No ETF holdings available for ${key}`);
    }
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const result = await getEtfHoldings(key);
  // Cache the null result too, so non-ETF tickers aren't re-resolved every load.
  etfHoldingsCache.set(key, result);
  if (!result) {
    throw new ApiError(404, `No ETF holdings available for ${key}`);
  }

  return NextResponse.json(result, { headers: CACHE_HEADERS });
});
