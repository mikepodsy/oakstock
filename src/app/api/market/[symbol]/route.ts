import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { marketCache } from "@/lib/cache";
import type { MarketIndicator, EconomicIndicatorData, EconomicDataPoint } from "@/types";

const yf = new YahooFinance();

const SYMBOL_CONFIG: Record<
  MarketIndicator,
  { ticker: string; name: string; unit: string }
> = {
  gold: { ticker: "GC=F", name: "Gold (Spot)", unit: "USD/oz" },
  dxy: { ticker: "DX-Y.NYB", name: "US Dollar Index (DXY)", unit: "Index" },
  sp500: { ticker: "^GSPC", name: "S&P 500", unit: "Index" },
  dowjones: { ticker: "^DJI", name: "Dow Jones", unit: "Index" },
};

const VALID_SYMBOLS = Object.keys(SYMBOL_CONFIG) as MarketIndicator[];

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
};

function getRangeStart(range: string): Date {
  const d = new Date();
  switch (range) {
    case "2y":
      d.setFullYear(d.getFullYear() - 2);
      break;
    case "5y":
      d.setFullYear(d.getFullYear() - 5);
      break;
    case "10y":
      d.setFullYear(d.getFullYear() - 10);
      break;
    case "max":
      d.setFullYear(1990, 0, 1);
      break;
    default:
      d.setFullYear(d.getFullYear() - 1);
  }
  return d;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  if (!VALID_SYMBOLS.includes(symbol as MarketIndicator)) {
    return NextResponse.json(
      { error: `Invalid symbol: ${symbol}. Must be one of: ${VALID_SYMBOLS.join(", ")}` },
      { status: 400 }
    );
  }

  const range = request.nextUrl.searchParams.get("range") || "1y";
  const config = SYMBOL_CONFIG[symbol as MarketIndicator];

  const cacheKey = `${symbol}:${range}`;
  const cached = marketCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const period1 = getRangeStart(range);
    const result = await yf.chart(config.ticker, {
      period1,
      interval: "1d",
    });

    const quotes = result.quotes || [];
    const data: EconomicDataPoint[] = quotes
      .filter((q: Record<string, unknown>) => q.close != null)
      .map((q: Record<string, unknown>) => ({
        date: new Date(q.date as string | number).toISOString().split("T")[0],
        value: parseFloat((q.close as number).toFixed(2)),
      }));

    const currentValue = data.length > 0 ? data[data.length - 1].value : null;
    const previousValue = data.length > 1 ? data[data.length - 2].value : null;
    const change =
      currentValue !== null && previousValue !== null
        ? parseFloat((currentValue - previousValue).toFixed(2))
        : null;

    const response: EconomicIndicatorData = {
      indicator: symbol as MarketIndicator,
      name: config.name,
      currentValue,
      previousValue,
      change,
      unit: config.unit,
      data,
      lastUpdated: new Date().toISOString(),
    };

    marketCache.set(cacheKey, response);
    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error(`Failed to fetch ${symbol}:`, err);
    return NextResponse.json(
      { error: `Failed to fetch ${symbol} data` },
      { status: 500 }
    );
  }
}
