import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Try quoteSummary first for sector data
    try {
      const summary = await yf.quoteSummary(ticker, {
        modules: ["price", "assetProfile"],
      });

      const price = summary.price;
      const profile = summary.assetProfile;

      return NextResponse.json({
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
      });
    } catch {
      // Fallback to quote() for indices and tickers that don't support quoteSummary
      const result = await yf.quote(ticker);

      return NextResponse.json({
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
        website: undefined,
        currency: result.currency ?? "USD",
      });
    }
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch quote for ${ticker}` },
      { status: 500 }
    );
  }
}
