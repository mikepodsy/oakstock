import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

async function fetchSingleQuote(ticker: string) {
  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ["price", "assetProfile"],
    });

    const price = summary.price;
    const profile = summary.assetProfile;

    return {
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
      currency: price?.currency ?? "USD",
    };
  } catch {
    // Fallback to quote() for indices and unsupported tickers
    const result = await yf.quote(ticker);
    return {
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
    const results = await Promise.allSettled(
      tickers.map((t) => fetchSingleQuote(t))
    );

    const quotes = results
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchSingleQuote>>> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value);

    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
