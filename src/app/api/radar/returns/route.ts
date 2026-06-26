import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getPeriodStartDate, getInterval } from "@/lib/history-utils";
import { radarReturnsCache } from "@/lib/cache";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

// "1d" is intentionally excluded — the Radar uses the live quote's day change for Today.
const VALID_PERIODS = new Set(["1w", "1m", "3m", "ytd", "1y"]);

// % return from the first to the last close in the period's chart.
async function fetchReturn(ticker: string, period: string): Promise<number | null> {
  const result = await yf.chart(ticker, {
    period1: getPeriodStartDate(period),
    interval: getInterval(period),
  });

  const closes = result.quotes
    .map((q) => q.close ?? q.adjclose)
    .filter((c): c is number => c != null);

  if (closes.length < 2) return null;
  const first = closes[0];
  const last = closes[closes.length - 1];
  if (!first) return null;
  return ((last - first) / first) * 100;
}

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
  for (const ticker of tickers) {
    const cached = radarReturnsCache.get(`${ticker}:${period}`);
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
        const change = await fetchReturn(ticker, period);
        radarReturnsCache.set(`${ticker}:${period}`, change);
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
