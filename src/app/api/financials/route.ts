import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { financialsCache } from "@/lib/cache";
import { buildFinancialData } from "@/lib/financials";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900",
};

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
      modules: [
        "defaultKeyStatistics",
        "financialData",
        "summaryDetail",
        "assetProfile",
      ],
    });

    const data = buildFinancialData(ticker, summary);
    financialsCache.set(ticker, data);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch financials for ${ticker}` },
      { status: 500 }
    );
  }
}
