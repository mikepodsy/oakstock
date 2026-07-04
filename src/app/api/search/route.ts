import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { apiHandler, withTimeout } from "@/lib/apiHandler";

const yf = new YahooFinance();

const YAHOO_TIMEOUT_MS = 10_000;

interface SearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  quoteType?: string;
}

export const GET = apiHandler("search", async (request: NextRequest) => {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  // validateResult: false — Yahoo's search response intermittently fails
  // yahoo-finance2's strict schema validation (FailedYahooValidationError),
  // which would otherwise 500 the whole search. We only read a few fields.
  const result = (await withTimeout(
    yf.search(query, { newsCount: 0 }, { validateResult: false }),
    YAHOO_TIMEOUT_MS,
    `search(${query})`
  )) as { quotes?: SearchQuote[] };

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
});
