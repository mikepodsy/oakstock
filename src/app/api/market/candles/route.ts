import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { marketCache } from "@/lib/cache";
import {
  computeRatioCandles,
  type OhlcBar,
  type RatioCandle,
} from "@/lib/ratioCandles";
import type { MarketIndicator } from "@/types";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
};

const VALID_RANGES = new Set(["3m", "6m", "1y", "2y", "5y"]);

// Single-ticker candle symbols. Derived symbols (rspSpy ratio) are handled
// separately; the vixeqVix spread is a card, not a candle series.
const TICKERS: Partial<Record<MarketIndicator, { ticker: string; name: string; decimals: number }>> = {
  gold: { ticker: "GC=F", name: "Gold", decimals: 2 },
  dxy: { ticker: "DX-Y.NYB", name: "US Dollar Index (DXY)", decimals: 2 },
  sp500: { ticker: "^GSPC", name: "S&P 500", decimals: 2 },
  dowjones: { ticker: "^DJI", name: "Dow Jones", decimals: 2 },
  vix: { ticker: "^VIX", name: "VIX", decimals: 2 },
  es: { ticker: "ES=F", name: "S&P 500 Futures (ES)", decimals: 2 },
  nq: { ticker: "NQ=F", name: "Nasdaq 100 Futures (NQ)", decimals: 2 },
};

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

function toCandles(bars: OhlcBar[], decimals: number): RatioCandle[] {
  const round = (n: number) => parseFloat(n.toFixed(decimals));
  return bars.map((b) => ({
    time: b.date,
    open: round(b.open),
    high: round(b.high),
    low: round(b.low),
    close: round(b.close),
  }));
}

export interface CandlesResponse {
  symbol: string;
  name: string;
  decimals: number;
  candles: RatioCandle[];
  lastUpdated: string;
}

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") || "") as MarketIndicator;
  const rangeParam = request.nextUrl.searchParams.get("range") || "1y";
  const range = VALID_RANGES.has(rangeParam) ? rangeParam : "1y";

  const single = TICKERS[symbol];
  if (!single && symbol !== "rspSpy") {
    return NextResponse.json(
      { error: `Unsupported candle symbol: ${symbol}` },
      { status: 400 }
    );
  }

  const cacheKey = `candles:${symbol}:${range}`;
  const cached = marketCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const period1 = getRangeStart(range);

    let candles: RatioCandle[];
    let name: string;
    let decimals: number;

    if (symbol === "rspSpy") {
      const [rsp, spy] = await Promise.all([
        fetchOhlc("RSP", period1),
        fetchOhlc("SPY", period1),
      ]);
      candles = computeRatioCandles(rsp, spy);
      name = "RSP / SPY (Breadth)";
      decimals = 4;
    } else {
      const bars = await fetchOhlc(single!.ticker, period1);
      candles = toCandles(bars, single!.decimals);
      name = single!.name;
      decimals = single!.decimals;
    }

    const response: CandlesResponse = {
      symbol,
      name,
      decimals,
      candles,
      lastUpdated: new Date().toISOString(),
    };

    marketCache.set(cacheKey, response);
    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error(`Failed to fetch candles for ${symbol}:`, err);
    return NextResponse.json(
      { error: `Failed to fetch candles for ${symbol}` },
      { status: 500 }
    );
  }
}
