import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { subDays, subMonths, subYears } from "date-fns";

const yf = new YahooFinance();

function getPeriodStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case "1d":
      return subDays(now, 1);
    case "5d":
      return subDays(now, 5);
    case "1w":
      return subDays(now, 7);
    case "1m":
      return subMonths(now, 1);
    case "3m":
      return subMonths(now, 3);
    case "6m":
      return subMonths(now, 6);
    case "1y":
      return subYears(now, 1);
    case "5y":
      return subYears(now, 5);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "3y":
      return subYears(now, 3);
    case "max":
      return new Date("2000-01-01");
    default:
      return subYears(now, 1);
  }
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const period = request.nextUrl.searchParams.get("period") ?? "1y";

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  try {
    const startDate = getPeriodStartDate(period);

    const result = await yf.chart(ticker, {
      period1: startDate,
      interval: ["1d", "5d", "1w", "1m"].includes(period) ? "1d" : "1wk",
    });

    const data = result.quotes.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      close: item.close ?? item.adjclose ?? 0,
    }));

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch history for ${ticker}` },
      { status: 500 }
    );
  }
}
