import { NextRequest, NextResponse } from "next/server";
import { fetchCandles, INTERVAL_WINDOWS } from "@/lib/candles";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

const DEFAULT_INTERVAL = "OneDay";

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const interval = request.nextUrl.searchParams.get("interval") ?? DEFAULT_INTERVAL;

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  if (INTERVAL_WINDOWS[interval] === undefined) {
    return NextResponse.json(
      { error: `invalid interval '${interval}'` },
      { status: 400 }
    );
  }

  try {
    const candles = await fetchCandles(ticker, interval);
    if (candles === null) {
      return NextResponse.json(
        { error: `No Questrade symbol found for '${ticker}'` },
        { status: 404 }
      );
    }
    return NextResponse.json(candles, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Failed to fetch Questrade candles for ${ticker}`, detail: message },
      { status: 500 }
    );
  }
}
