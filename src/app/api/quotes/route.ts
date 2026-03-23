import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { quoteCache } from "@/lib/cache";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
};

async function fetchSingleQuote(ticker: string) {
  const cached = quoteCache.get(ticker);
  if (cached) return cached;
  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ["price", "assetProfile"],
    });

    const price = summary.price;
    const profile = summary.assetProfile;

    const data = {
      ticker: price?.symbol ?? ticker,
      name: price?.shortName ?? price?.longName ?? ticker,
      currentPrice: price?.regularMarketPrice ?? 0,
      previousClose: price?.regularMarketPreviousClose ?? 0,
      dayChange: price?.regularMarketChange ?? 0,
      dayChangePercent: price?.regularMarketChangePercent
        ? price.regularMarketChangePercent * 100
        : 0,
      marketCap: price?.marketCap ?? undefined,
      peRatio: undefined,
      fiftyTwoWeekHigh: undefined,
      fiftyTwoWeekLow: undefined,
      sector: profile?.sector ?? undefined,
      website: profile?.website ?? undefined,
      currency: price?.currency ?? "USD",
    };
    quoteCache.set(ticker, data);
    return data;
  } catch {
    // Fallback to quote() for indices and unsupported tickers
    const result = await yf.quote(ticker);
    const data = {
      ticker: result.symbol,
      name: result.shortName ?? result.longName ?? result.symbol,
      currentPrice: result.regularMarketPrice ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      dayChange: result.regularMarketChange ?? 0,
      dayChangePercent: result.regularMarketChangePercent ?? 0,
      marketCap: result.marketCap ?? undefined,
      peRatio: result.trailingPE ?? undefined,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh ?? undefined,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow ?? undefined,
      sector: undefined,
      currency: result.currency ?? "USD",
    };
    quoteCache.set(ticker, data);
    return data;
  }
}

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");

  if (!tickersParam) {
    return NextResponse.json(
      { error: "tickers parameter is required" },
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

  try {
    // Process in batches of 20 to avoid overwhelming Yahoo Finance
    const BATCH_SIZE = 20;
    const quotes: Awaited<ReturnType<typeof fetchSingleQuote>>[] = [];

    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((t) => fetchSingleQuote(t))
      );
      for (const r of results) {
        if (r.status === "fulfilled") quotes.push(r.value);
      }
    }

    return NextResponse.json(quotes, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
