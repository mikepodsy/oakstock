import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { marketCache } from "@/lib/cache";
import { computeRatioCandles, type OhlcBar, type RatioCandle } from "@/lib/ratioCandles";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
};

const VALID_RANGES = new Set(["3m", "6m", "1y", "2y", "5y"]);

function getRangeStart(range: string): Date {
  const d = new Date();
  switch (range) {
    case "3m":
      d.setMonth(d.getMonth() - 3);
      break;
    case "6m":
      d.setMonth(d.getMonth() - 6);
      break;
    case "2y":
      d.setFullYear(d.getFullYear() - 2);
      break;
    case "5y":
      d.setFullYear(d.getFullYear() - 5);
      break;
    default:
      d.setFullYear(d.getFullYear() - 1); // 1y
  }
  return d;
}

/** Fetch a Yahoo daily OHLC series keyed by YYYY-MM-DD. */
async function fetchOhlc(ticker: string, period1: Date): Promise<OhlcBar[]> {
  const result = await yf.chart(ticker, { period1, interval: "1d" });
  const quotes = result.quotes || [];
  return quotes
    .filter(
      (q) =>
        q.open != null && q.high != null && q.low != null && q.close != null
    )
    .map((q) => ({
      date: new Date(q.date).toISOString().split("T")[0],
      open: q.open as number,
      high: q.high as number,
      low: q.low as number,
      close: q.close as number,
    }));
}

export interface RspSpyCandlesResponse {
  name: string;
  candles: RatioCandle[];
  lastUpdated: string;
}

export async function GET(request: NextRequest) {
  const rangeParam = request.nextUrl.searchParams.get("range") || "1y";
  const range = VALID_RANGES.has(rangeParam) ? rangeParam : "1y";

  const cacheKey = `rspSpyCandles:${range}`;
  const cached = marketCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const period1 = getRangeStart(range);
    const [rsp, spy] = await Promise.all([
      fetchOhlc("RSP", period1),
      fetchOhlc("SPY", period1),
    ]);

    const candles = computeRatioCandles(rsp, spy);

    const response: RspSpyCandlesResponse = {
      name: "RSP / SPY (Breadth)",
      candles,
      lastUpdated: new Date().toISOString(),
    };

    marketCache.set(cacheKey, response);
    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error("Failed to fetch RSP/SPY candles:", err);
    return NextResponse.json(
      { error: "Failed to fetch RSP/SPY candles" },
      { status: 500 }
    );
  }
}
