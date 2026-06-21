import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { radarCache } from "@/lib/cache";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=120",
};

// GET /api/radar/trending?count=25
// Returns Yahoo's market-wide trending tickers (search-interest based).
export async function GET(req: NextRequest) {
  const count = Math.min(Number(req.nextUrl.searchParams.get("count") ?? 25) || 25, 50);

  const cacheKey = `trending:US:${count}`;
  const cached = radarCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const result = await yf.trendingSymbols("US", { count }, { validateResult: false });
    const quotes = (result as { quotes?: { symbol?: string }[] }).quotes ?? [];
    const symbols = quotes
      .map((q) => q.symbol)
      .filter((s): s is string => Boolean(s));

    radarCache.set(cacheKey, symbols);
    return NextResponse.json(symbols, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error("[radar/trending] failed:", err);
    return NextResponse.json([], { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
