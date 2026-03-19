import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const result = await yf.search(query, { newsCount: 0 });

    const results = (result.quotes ?? [])
      .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
      .slice(0, 10)
      .map((q) => ({
        ticker: q.symbol,
        name: q.shortname ?? q.longname ?? q.symbol,
        exchange: q.exchDisp ?? q.exchange ?? "",
        type: q.quoteType,
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
