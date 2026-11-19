import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiHandler } from "@/lib/apiHandler";
import { compHistoryCache } from "@/lib/cache";
import { getFundamentals } from "@/lib/fundamentals";
import { combineHistory, peSeries, type PeSeriesPoint } from "@/lib/comps/history";
import { fetchCloses, fetchShareHistory, historyContext, mapLimit, parseTickers } from "@/lib/comps/load";

const YEARS = 5;
const MAX_PEERS = 15;

async function seriesFor(ticker: string): Promise<PeSeriesPoint[]> {
  const cached = compHistoryCache.get(ticker) as PeSeriesPoint[] | undefined;
  if (cached) return cached;
  try {
    const [prices, fundamentals, shareHistory] = await Promise.all([
      fetchCloses(ticker, YEARS * 366 + 31, "1d"),
      getFundamentals(ticker),
      fetchShareHistory(ticker).catch(() => []),
    ]);
    if (!fundamentals) return [];
    const { fx, shareScale, shares } = await historyContext(ticker, shareHistory);
    const series = peSeries(prices, fundamentals.quarterly, shares, { fx, shareScale });
    compHistoryCache.set(ticker, series);
    return series;
  } catch (err) {
    console.warn(`[comps/history] ${ticker}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// GET /api/comps/history?ticker=NVDA&peers=AMD,AVGO → { metric: "pe", points: HistoryPoint[] }
export const GET = apiHandler("comps/history", async (request: NextRequest) => {
  const [ticker] = parseTickers(request.nextUrl.searchParams.get("ticker"), 1);
  if (!ticker) throw new ApiError(400, "ticker parameter is required");
  const peers = parseTickers(request.nextUrl.searchParams.get("peers"), MAX_PEERS).filter(
    (p) => p !== ticker
  );

  const [target, ...peerSeries] = await mapLimit([ticker, ...peers], 4, seriesFor);
  return NextResponse.json(
    { metric: "pe", points: combineHistory(target, peerSeries) },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } }
  );
});
