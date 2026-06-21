import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { radarCache } from "@/lib/cache";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=120",
};

// Only the predefined screens the Radar ranking dropdown can request
const ALLOWED = new Set(["day_gainers", "day_losers"]);

// GET /api/radar/screener?type=day_gainers&count=50
// Returns a ranked list of ticker symbols (top movers, market-wide).
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "day_gainers";
  const count = Math.min(Number(req.nextUrl.searchParams.get("count") ?? 50) || 50, 100);

  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: "Unsupported screener type" }, { status: 400 });
  }

  const cacheKey = `screener:${type}:${count}`;
  const cached = radarCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const result = await yf.screener(
      { scrIds: type as "day_gainers" | "day_losers", count },
      undefined,
      { validateResult: false }
    );
    const quotes = (result as { quotes?: { symbol?: string }[] }).quotes ?? [];
    const symbols = quotes
      .map((q) => q.symbol)
      .filter((s): s is string => Boolean(s));

    radarCache.set(cacheKey, symbols);
    return NextResponse.json(symbols, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error("[radar/screener] failed:", err);
    return NextResponse.json([], { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
