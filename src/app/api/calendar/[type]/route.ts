import { NextRequest, NextResponse } from "next/server";
import { calendarCache } from "@/lib/cache";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const VALID_TYPES = ["earnings", "dividends", "economic", "ipo"] as const;

const ENDPOINT_MAP: Record<string, string> = {
  earnings: "earnings-calendar",
  dividends: "dividends-calendar",
  economic: "economic-calendar",
  ipo: "ipos-calendar",
};

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
};

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function defaultDateRange() {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 30);
  return { from: formatDate(from), to: formatDate(to) };
}

function normalizeEarnings(items: Record<string, unknown>[]) {
  return items.map((item) => ({
    date: item.date as string,
    symbol: item.symbol as string,
    company: (item.symbol as string) ?? "",
    epsEstimated: item.epsEstimated != null ? Number(item.epsEstimated) : null,
    epsActual: item.epsActual != null ? Number(item.epsActual) : null,
    revenueEstimated: item.revenueEstimated != null ? Number(item.revenueEstimated) : null,
    revenueActual: item.revenueActual != null ? Number(item.revenueActual) : null,
    time: null,
    isPortfolioStock: false,
  }));
}

function normalizeDividends(items: Record<string, unknown>[]) {
  return items.map((item) => ({
    date: item.date as string,
    symbol: item.symbol as string,
    company: (item.symbol as string) ?? "",
    dividend: Number(item.dividend ?? item.adjDividend ?? 0),
    yield: item.yield != null ? Number(item.yield) : null,
    paymentDate: (item.paymentDate as string) ?? null,
    recordDate: (item.recordDate as string) ?? null,
    isPortfolioStock: false,
  }));
}

function normalizeEconomic(items: Record<string, unknown>[]) {
  return items.map((item) => ({
    date: item.date as string,
    event: item.event as string,
    country: item.country as string,
    previous: item.previous != null ? Number(item.previous) : null,
    forecast: item.estimate != null ? Number(item.estimate) : null,
    actual: item.actual != null ? Number(item.actual) : null,
    impact: (item.impact as string) ?? "Low",
  }));
}

function normalizeIpo(items: Record<string, unknown>[]) {
  return items.map((item) => ({
    date: item.date as string,
    symbol: (item.symbol as string) ?? "",
    company: (item.company as string) ?? "",
    exchange: (item.exchange as string) ?? "",
    priceRange: (item.priceRange as string) ?? null,
    sharesOffered: item.shares != null ? Number(item.shares) : null,
    marketCap: item.marketCap != null ? Number(item.marketCap) : null,
    isPortfolioStock: false,
  }));
}

const NORMALIZERS: Record<string, (items: Record<string, unknown>[]) => unknown[]> = {
  earnings: normalizeEarnings,
  dividends: normalizeDividends,
  economic: normalizeEconomic,
  ipo: normalizeIpo,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;

  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json(
      { error: `Invalid calendar type: ${type}. Must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const defaults = defaultDateRange();
  const dateFrom = from || defaults.from;
  const dateTo = to || defaults.to;

  const cacheKey = `${type}:${dateFrom}:${dateTo}`;
  const cached = calendarCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FMP_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const endpoint = ENDPOINT_MAP[type];
    const url = `${FMP_BASE}/${endpoint}?from=${dateFrom}&to=${dateTo}&apikey=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `FMP API error: ${text}` },
        { status: res.status }
      );
    }

    const raw = await res.json();
    const items = Array.isArray(raw) ? raw : [];
    const normalized = NORMALIZERS[type](items);

    calendarCache.set(cacheKey, normalized);
    return NextResponse.json(normalized, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch ${type} calendar` },
      { status: 500 }
    );
  }
}
