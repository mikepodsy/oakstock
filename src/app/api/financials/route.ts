import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { financialsCache } from "@/lib/cache";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900",
};

const RATING_MAP: Record<string, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  underperform: "Underperform",
  sell: "Sell",
  strong_sell: "Strong Sell",
};

function extractDomain(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function formatRating(key: string | undefined | null): string | null {
  if (!key) return null;
  return RATING_MAP[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  const cached = financialsCache.get(ticker);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ["defaultKeyStatistics", "financialData", "assetProfile"],
    });

    const stats = summary.defaultKeyStatistics;
    const fin = summary.financialData;
    const profile = summary.assetProfile;

    const data = {
      ticker,
      peRatio: stats?.trailingPE ?? null,
      eps: stats?.trailingEps ?? null,
      revenue: fin?.totalRevenue ?? null,
      profitMargin: fin?.profitMargins ?? null,
      debtToEquity: fin?.debtToEquity ?? null,
      dividendYield: stats?.dividendYield ?? null,
      volume: fin?.volume ?? null,
      fiftyTwoWeekHigh: stats?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: stats?.fiftyTwoWeekLow ?? null,
      description: profile?.longBusinessSummary ?? null,
      analystRating: formatRating(fin?.recommendationKey),
      targetPrice: fin?.targetMeanPrice ?? null,
      website: extractDomain(profile?.website),
    };
    financialsCache.set(ticker, data);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch financials for ${ticker}` },
      { status: 500 }
    );
  }
}
