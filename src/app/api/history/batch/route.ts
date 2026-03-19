import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getPeriodStartDate, getInterval } from "@/lib/history-utils";
import { historyCache } from "@/lib/cache";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

const VALID_PERIODS = new Set([
  "1d", "5d", "1w", "1m", "3m", "6m", "ytd", "1y", "3y", "5y", "max",
]);

async function fetchPeriod(
  ticker: string,
  period: string
): Promise<Array<{ date: string; close: number }>> {
  const startDate = getPeriodStartDate(period);
  const result = await yf.chart(ticker, {
    period1: startDate,
    interval: getInterval(period),
  });

  return result.quotes
    .filter((item) => item.close != null || item.adjclose != null)
    .map((item) => ({
      date: item.date.toISOString().split("T")[0],
      close: (item.close ?? item.adjclose)!,
    }));
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const periodsParam = request.nextUrl.searchParams.get("periods");

  if (!ticker || !periodsParam) {
    return NextResponse.json(
      { error: "ticker and periods parameters are required" },
      { status: 400 }
    );
  }

  const periods = periodsParam
    .split(",")
    .map((p) => p.trim())
    .filter((p) => VALID_PERIODS.has(p));

  if (periods.length === 0) {
    return NextResponse.json(
      { error: "no valid periods provided" },
      { status: 400 }
    );
  }

  const result: Record<string, Array<{ date: string; close: number }>> = {};
  const uncached: string[] = [];

  // Check cache first for each period
  for (const period of periods) {
    const cacheKey = `${ticker}:${period}`;
    const cached = historyCache.get(cacheKey);
    if (cached) {
      result[period] = cached;
    } else {
      uncached.push(period);
    }
  }

  // Fetch uncached periods in parallel
  if (uncached.length > 0) {
    const fetches = await Promise.allSettled(
      uncached.map(async (period) => {
        const data = await fetchPeriod(ticker, period);
        historyCache.set(`${ticker}:${period}`, data);
        return { period, data };
      })
    );

    for (const res of fetches) {
      if (res.status === "fulfilled") {
        result[res.value.period] = res.value.data;
      }
    }
  }

  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
