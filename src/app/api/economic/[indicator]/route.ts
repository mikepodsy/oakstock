import { NextRequest, NextResponse } from "next/server";
import { economicCache } from "@/lib/cache";
import type { EconomicIndicator, EconomicIndicatorData, EconomicDataPoint } from "@/types";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

const SERIES_CONFIG: Record<
  EconomicIndicator,
  { id: string; name: string; unit: string; isInflation: boolean }
> = {
  inflation: {
    id: "CPIAUCSL",
    name: "Inflation Rate (CPI YoY)",
    unit: "%",
    isInflation: true,
  },
  unemployment: {
    id: "UNRATE",
    name: "Unemployment Rate",
    unit: "%",
    isInflation: false,
  },
  oil: {
    id: "DCOILWTICO",
    name: "WTI Crude Oil",
    unit: "USD/barrel",
    isInflation: false,
  },
};

const VALID_INDICATORS = Object.keys(SERIES_CONFIG) as EconomicIndicator[];

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
};

function calculateInflationRate(
  observations: Array<{ date: string; value: string }>
): EconomicDataPoint[] {
  const result: EconomicDataPoint[] = [];
  for (let i = 12; i < observations.length; i++) {
    const current = parseFloat(observations[i].value);
    const yearAgo = parseFloat(observations[i - 12].value);
    if (!isNaN(current) && !isNaN(yearAgo) && yearAgo > 0) {
      result.push({
        date: observations[i].date,
        value: parseFloat((((current - yearAgo) / yearAgo) * 100).toFixed(2)),
      });
    }
  }
  return result;
}

function normalizeData(
  observations: Array<{ date: string; value: string }>,
  isInflation: boolean
): EconomicDataPoint[] {
  if (isInflation) return calculateInflationRate(observations);
  return observations
    .map((obs) => ({ date: obs.date, value: parseFloat(obs.value) }))
    .filter((p) => !isNaN(p.value));
}

function getObservationStart(range: string, isInflation: boolean): string {
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
  if (isInflation) d.setMonth(d.getMonth() - 12);
  return d.toISOString().split("T")[0];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ indicator: string }> }
) {
  const { indicator } = await params;

  if (!VALID_INDICATORS.includes(indicator as EconomicIndicator)) {
    return NextResponse.json(
      { error: `Invalid indicator: ${indicator}. Must be one of: ${VALID_INDICATORS.join(", ")}` },
      { status: 400 }
    );
  }

  const range = request.nextUrl.searchParams.get("range") || "1y";
  const config = SERIES_CONFIG[indicator as EconomicIndicator];

  const cacheKey = `${indicator}:${range}`;
  const cached = economicCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FRED_API_KEY not configured" }, { status: 500 });
  }

  try {
    const startDate = getObservationStart(range, config.isInflation);
    const url = new URL(FRED_BASE);
    url.searchParams.set("series_id", config.id);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("observation_start", startDate);
    url.searchParams.set("sort_order", "asc");

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `FRED API error: ${text}` }, { status: res.status });
    }

    const raw = await res.json();
    const observations = raw.observations || [];
    const data = normalizeData(observations, config.isInflation);

    const currentValue = data.length > 0 ? data[data.length - 1].value : null;
    const previousValue = data.length > 1 ? data[data.length - 2].value : null;
    const change =
      currentValue !== null && previousValue !== null
        ? parseFloat((currentValue - previousValue).toFixed(2))
        : null;

    const result: EconomicIndicatorData = {
      indicator: indicator as EconomicIndicator,
      name: config.name,
      currentValue,
      previousValue,
      change,
      unit: config.unit,
      data,
      lastUpdated: new Date().toISOString(),
    };

    economicCache.set(cacheKey, result);
    return NextResponse.json(result, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: `Failed to fetch ${indicator} data` }, { status: 500 });
  }
}
