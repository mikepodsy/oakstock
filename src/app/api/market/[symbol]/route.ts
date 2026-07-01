import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { marketCache } from "@/lib/cache";
import { downsample } from "@/lib/downsample";
import type { MarketIndicator, EconomicIndicatorData, EconomicDataPoint } from "@/types";

const yf = new YahooFinance();

type DerivedConfig = {
  a: string;
  b: string;
  op: "ratio" | "spread";
  name: string;
  unit: string;
  // When set, the series is built from intraday bars over `lookbackDays` and
  // the two tickers are aligned by hour bucket (used for indices such as
  // ^VIXEQ that have no daily history on Yahoo, only recent intraday bars).
  interval?: "1h";
  lookbackDays?: number;
};
type SymbolConfig =
  | { ticker: string; name: string; unit: string }
  | DerivedConfig;

const SYMBOL_CONFIG: Record<MarketIndicator, SymbolConfig> = {
  gold: { ticker: "GC=F", name: "Gold", unit: "USD/oz" },
  dxy: { ticker: "DX-Y.NYB", name: "US Dollar Index (DXY)", unit: "Index" },
  sp500: { ticker: "^GSPC", name: "S&P 500", unit: "Index" },
  dowjones: { ticker: "^DJI", name: "Dow Jones", unit: "Index" },
  vix: { ticker: "^VIX", name: "VIX", unit: "Index" },
  es: { ticker: "ES=F", name: "S&P 500 Futures (ES)", unit: "Index" },
  nq: { ticker: "NQ=F", name: "Nasdaq 100 Futures (NQ)", unit: "Index" },
  rspSpy: { a: "RSP", b: "SPY", op: "ratio", name: "RSP / SPY (Breadth)", unit: "Ratio" },
  vixeqVix: {
    a: "^VIXEQ",
    b: "^VIX",
    op: "spread",
    name: "VIXEQ − VIX (Dispersion)",
    unit: "Index",
    interval: "1h",
    lookbackDays: 5,
  },
};

function isDerived(config: SymbolConfig): config is DerivedConfig {
  return "a" in config;
}

type Point = { key: string; date: string; value: number };

/** Fetch a Yahoo close series. Daily keys by YYYY-MM-DD; intraday keys by hour bucket. */
async function fetchSeries(
  ticker: string,
  period1: Date,
  interval: "1d" | "1h" = "1d"
): Promise<Point[]> {
  const result = await yf.chart(ticker, { period1, interval });
  const quotes = result.quotes || [];
  return quotes
    .filter((q: Record<string, unknown>) => q.close != null)
    .map((q: Record<string, unknown>) => {
      const d = new Date(q.date as string | number);
      if (interval === "1h") {
        const bucket = new Date(d);
        bucket.setMinutes(0, 0, 0);
        return { key: bucket.toISOString(), date: d.toISOString(), value: q.close as number };
      }
      const day = d.toISOString().split("T")[0];
      return { key: day, date: day, value: q.close as number };
    });
}

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
      d.setFullYear(1950, 0, 1);
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

    let data: EconomicDataPoint[];
    if (isDerived(config)) {
      // Derived two-ticker series: fetch both, align by shared key, combine.
      // Intraday configs use recent hourly bars (aligned by hour bucket) for
      // indices without daily history; daily configs align by calendar date.
      const interval = config.interval ?? "1d";
      const start = config.interval
        ? new Date(Date.now() - (config.lookbackDays ?? 5) * 86_400_000)
        : period1;
      const [seriesA, seriesB] = await Promise.all([
        fetchSeries(config.a, start, interval),
        fetchSeries(config.b, start, interval),
      ]);
      const mapB = new Map(seriesB.map((d) => [d.key, d.value]));
      const decimals = config.op === "ratio" ? 4 : 2;
      data = seriesA.reduce<EconomicDataPoint[]>((acc, point) => {
        const valB = mapB.get(point.key);
        if (valB !== undefined && valB !== 0) {
          const combined =
            config.op === "ratio" ? point.value / valB : point.value - valB;
          acc.push({ date: point.date, value: parseFloat(combined.toFixed(decimals)) });
        }
        return acc;
      }, []);
    } else {
      data = (await fetchSeries(config.ticker, period1)).map((p) => ({
        date: p.date,
        value: parseFloat(p.value.toFixed(2)),
      }));
    }

    const currentValue = data.length > 0 ? data[data.length - 1].value : null;
    const previousValue = data.length > 1 ? data[data.length - 2].value : null;
    const changeDecimals = config.unit === "Ratio" ? 4 : 2;
    const change =
      currentValue !== null && previousValue !== null
        ? parseFloat((currentValue - previousValue).toFixed(changeDecimals))
        : null;

    const response: EconomicIndicatorData = {
      indicator: symbol as MarketIndicator,
      name: config.name,
      currentValue,
      previousValue,
      change,
      unit: config.unit,
      data: downsample(data),
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
