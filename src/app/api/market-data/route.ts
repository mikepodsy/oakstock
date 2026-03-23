import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { subDays, subMonths, subYears, startOfYear } from "date-fns";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

// Start of chart data: 2 months before year start, so we have enough lookback for 1M calc in Jan
function chartStartDate(): Date {
  return subMonths(startOfYear(new Date()), 2);
}

interface DayClose {
  date: Date;
  close: number;
}

function calcReturn(data: DayClose[], lookbackDays: number): number | null {
  if (data.length < lookbackDays + 1) return null;
  const current = data[data.length - 1].close;
  const past = data[data.length - 1 - lookbackDays].close;
  if (!past) return null;
  return ((current - past) / past) * 100;
}

function calcYtd(data: DayClose[]): number | null {
  const ys = startOfYear(new Date());
  const ytdSlice = data.filter((d) => d.date >= ys);
  if (ytdSlice.length < 2) return null;
  const start = ytdSlice[0].close;
  const end = ytdSlice[ytdSlice.length - 1].close;
  if (!start) return null;
  return ((end - start) / start) * 100;
}

function calc3y(data: DayClose[]): number | null {
  if (data.length < 2) return null;
  const start = data[0].close;
  const end = data[data.length - 1].close;
  if (!start) return null;
  return ((end - start) / start) * 100;
}

async function fetchMarketItem(ticker: string) {
  // Run quote and chart in parallel
  const [quoteRes, chartRes, chart3yRes] = await Promise.allSettled([
    yf.quote(ticker),
    yf.chart(ticker, { period1: chartStartDate(), interval: "1d" }),
    yf.chart(ticker, { period1: subYears(new Date(), 3), interval: "1wk" }),
  ]);

  if (quoteRes.status === "rejected") return null;
  const q = quoteRes.value;

  // Daily chart for 5d, 1m, ytd
  let fiveDays: number | null = null;
  let oneMonth: number | null = null;
  let ytd: number | null = null;

  if (chartRes.status === "fulfilled") {
    const closes: DayClose[] = chartRes.value.quotes
      .filter((p) => (p.close ?? p.adjclose) != null)
      .map((p) => ({ date: p.date, close: (p.close ?? p.adjclose)! }));

    fiveDays = calcReturn(closes, 5);
    oneMonth = calcReturn(closes, 21);
    ytd = calcYtd(closes);
  }

  // Weekly 3y chart for 3yr return
  let threeYears: number | null = null;
  if (chart3yRes.status === "fulfilled") {
    const closes: DayClose[] = chart3yRes.value.quotes
      .filter((p) => (p.close ?? p.adjclose) != null)
      .map((p) => ({ date: p.date, close: (p.close ?? p.adjclose)! }));
    threeYears = calc3y(closes);
  }

  // fiftyTwoWeekChangePercent from Yahoo Finance is a decimal (e.g. 0.1469 = 14.69%)
  const oneYear =
    q.fiftyTwoWeekChangePercent != null
      ? q.fiftyTwoWeekChangePercent * 100
      : null;

  return {
    ticker: q.symbol ?? ticker,
    name: q.shortName ?? q.longName ?? ticker,
    price: q.regularMarketPrice ?? 0,
    dayLow: q.regularMarketDayLow ?? null,
    dayHigh: q.regularMarketDayHigh ?? null,
    weekLow52: q.fiftyTwoWeekLow ?? null,
    weekHigh52: q.fiftyTwoWeekHigh ?? null,
    currency: q.currency ?? "USD",
    returns: {
      today: q.regularMarketChangePercent ?? 0,
      fiveDays,
      oneMonth,
      ytd,
      oneYear,
      threeYears,
    },
  };
}

export type MarketDataItem = NonNullable<
  Awaited<ReturnType<typeof fetchMarketItem>>
>;

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");
  if (!tickersParam) {
    return NextResponse.json({ error: "tickers required" }, { status: 400 });
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!tickers.length) {
    return NextResponse.json({ error: "no valid tickers" }, { status: 400 });
  }

  const settled = await Promise.allSettled(tickers.map(fetchMarketItem));

  const data = settled
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return NextResponse.json(data, { headers: CACHE_HEADERS });
}
