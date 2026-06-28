import { NextResponse } from "next/server";
import { fetchDailyCandles } from "@/lib/candles";
import { evaluateMomentum, type MomentumStatus } from "@/utils/momentum";
import { MAG7 } from "@/utils/constants";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

// Momentum status for the Alerts page: 50d/200d MA state for each Mag 7 stock.
// Each ticker is fetched independently so one failure (or an unresolved symbol)
// is isolated — the rest still return.
export async function GET() {
  const results = await Promise.allSettled(
    MAG7.map(async (ticker) => {
      const candles = await fetchDailyCandles(ticker);
      if (!candles || candles.length === 0) return null;
      return evaluateMomentum(ticker, candles);
    })
  );

  const statuses: MomentumStatus[] = [];
  const errors: { ticker: string; detail: string }[] = [];

  results.forEach((result, i) => {
    const ticker = MAG7[i];
    if (result.status === "fulfilled") {
      if (result.value) statuses.push(result.value);
      else errors.push({ ticker, detail: "no candle data" });
    } else {
      const detail =
        result.reason instanceof Error ? result.reason.message : "unknown error";
      errors.push({ ticker, detail });
    }
  });

  // Surface a hard error only when nothing came back at all (e.g. auth is down).
  if (statuses.length === 0) {
    return NextResponse.json(
      { error: "Failed to fetch momentum alerts", errors },
      { status: 502 }
    );
  }

  return NextResponse.json({ statuses, errors }, { headers: CACHE_HEADERS });
}
