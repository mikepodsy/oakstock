import { NextRequest, NextResponse } from "next/server";
import { fetchMacroNews, fetchStockNews } from "@/lib/news";
import { generateDailyBrief } from "@/lib/brief";
import type { DailyBrief, MacroNewsItem, StockNewsItem } from "@/types/news";

// Cache the generated brief once per trading day. Keyed by date + ticker set
// so each portfolio gets its own brief but repeat loads within the day reuse
// it instead of re-calling Claude. In-memory (per serverless instance); the
// Cache-Control header lets the CDN serve it too.
const briefCache = new Map<string, DailyBrief>();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
};

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get("symbols");
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  const symbols = (symbolsParam ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .sort();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "brief_unavailable" }, { status: 503 });
  }

  const date = todayYMD();
  const cacheKey = `${date}:${symbols.join(",")}`;

  if (!refresh) {
    const cached = briefCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: CACHE_HEADERS });
    }
  }

  // Fetch both news sources; tolerate partial failure.
  const [macroResult, stockResult] = await Promise.allSettled([
    fetchMacroNews(),
    fetchStockNews(symbols),
  ]);

  const macro: MacroNewsItem[] =
    macroResult.status === "fulfilled" ? macroResult.value : [];
  const stocks: StockNewsItem[] =
    stockResult.status === "fulfilled" ? stockResult.value : [];

  if (macro.length === 0 && stocks.length === 0) {
    return NextResponse.json({ error: "no_news" }, { status: 503 });
  }

  try {
    const generated = await generateDailyBrief(macro, stocks);
    const brief: DailyBrief = { date, ...generated };
    briefCache.set(cacheKey, brief);
    return NextResponse.json(brief, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error("[news/brief] Failed to generate brief:", err);
    return NextResponse.json({ error: "brief_unavailable" }, { status: 503 });
  }
}
