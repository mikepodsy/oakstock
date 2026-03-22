import { NextRequest, NextResponse } from "next/server";
import { calendarCache } from "@/lib/cache";

const FMP_BASE = "https://financialmodelingprep.com/stable";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
};

const MAX_LOOKBACK_YEARS = 10;

interface HistoricalDividend {
  date: string;
  dividend: number;
}

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");
  const fromParam = request.nextUrl.searchParams.get("from");

  if (!tickersParam) {
    return NextResponse.json(
      { error: "tickers parameter is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FMP_API_KEY not configured" },
      { status: 500 }
    );
  }

  const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);

  // Enforce max lookback
  const maxLookback = new Date();
  maxLookback.setFullYear(maxLookback.getFullYear() - MAX_LOOKBACK_YEARS);
  const fromDate = fromParam && new Date(fromParam) > maxLookback
    ? fromParam
    : maxLookback.toISOString().split("T")[0];

  const result: Record<string, HistoricalDividend[]> = {};

  await Promise.all(
    tickers.map(async (ticker) => {
      const cacheKey = `div-income:${ticker}`;
      const cached = calendarCache.get(cacheKey) as HistoricalDividend[] | undefined;

      if (cached) {
        result[ticker] = cached.filter((d) => d.date >= fromDate);
        return;
      }

      try {
        const url = `${FMP_BASE}/historical-price-eod/dividend/${ticker}?apikey=${apiKey}`;
        const res = await fetch(url);

        if (!res.ok) {
          result[ticker] = [];
          return;
        }

        const raw = await res.json();
        const items: HistoricalDividend[] = (Array.isArray(raw) ? raw : [])
          .map((item: Record<string, unknown>) => ({
            date: item.date as string,
            dividend: Number(item.dividend ?? item.adjDividend ?? 0),
          }))
          .filter((d: HistoricalDividend) => d.dividend > 0);

        calendarCache.set(cacheKey, items);
        result[ticker] = items.filter((d) => d.date >= fromDate);
      } catch {
        result[ticker] = [];
      }
    })
  );

  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
