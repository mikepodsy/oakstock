import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getPeriodStartDate, getInterval } from "@/lib/history-utils";
import { historyCache } from "@/lib/cache";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const period = request.nextUrl.searchParams.get("period") ?? "1y";

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  const cacheKey = `${ticker}:${period}`;
  const cached = historyCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const startDate = getPeriodStartDate(period);

    const result = await yf.chart(ticker, {
      period1: startDate,
      interval: getInterval(period),
    });

    const data = result.quotes
      .filter((item) => item.close != null || item.adjclose != null)
      .map((item) => ({
        date: item.date.toISOString().split("T")[0],
        close: (item.close ?? item.adjclose)!,
      }));

    historyCache.set(cacheKey, data);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch history for ${ticker}` },
      { status: 500 }
    );
  }
}
