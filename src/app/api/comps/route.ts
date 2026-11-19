import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiHandler } from "@/lib/apiHandler";
import { loadCompRow, mapLimit, parseTickers } from "@/lib/comps/load";

const MAX_TICKERS = 16;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900",
};

// GET /api/comps?tickers=NVDA,AMD,AVGO → { rows: CompRow[] } in request order.
export const GET = apiHandler("comps", async (request: NextRequest) => {
  const tickers = parseTickers(request.nextUrl.searchParams.get("tickers"), MAX_TICKERS);
  if (tickers.length === 0) throw new ApiError(400, "tickers parameter is required");
  const rows = await mapLimit(tickers, 4, loadCompRow);
  return NextResponse.json({ rows }, { headers: CACHE_HEADERS });
});
