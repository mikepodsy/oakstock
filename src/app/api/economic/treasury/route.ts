import { NextRequest, NextResponse } from "next/server";
import { treasuryCache } from "@/lib/cache";
import type { TreasuryMaturity, TreasurySeriesData, TreasuryBundleData, EconomicDataPoint } from "@/types";

const TREASURY_SERIES: Record<TreasuryMaturity, { id: string; label: string }> = {
  "1mo": { id: "DGS1MO", label: "1 Month" },
  "3mo": { id: "DGS3MO", label: "3 Month" },
  "6mo": { id: "DGS6MO", label: "6 Month" },
  "1y": { id: "DGS1", label: "1 Year" },
  "2y": { id: "DGS2", label: "2 Year" },
  "5y": { id: "DGS5", label: "5 Year" },
  "10y": { id: "DGS10", label: "10 Year" },
  "20y": { id: "DGS20", label: "20 Year" },
  "30y": { id: "DGS30", label: "30 Year" },
};

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
};

function getObservationStart(range: string): string {
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
  return d.toISOString().split("T")[0];
}

async function fetchSeries(
  seriesId: string,
  apiKey: string,
  startDate: string
): Promise<EconomicDataPoint[]> {
  const url = new URL(FRED_BASE);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", startDate);
  url.searchParams.set("sort_order", "asc");

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const raw = await res.json();
  return (raw.observations || [])
    .map((obs: { date: string; value: string }) => ({
      date: obs.date,
      value: parseFloat(obs.value),
    }))
    .filter((p: EconomicDataPoint) => !isNaN(p.value));
}

export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") || "1y";

  const cacheKey = `treasury:${range}`;
  const cached = treasuryCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FRED_API_KEY not configured" }, { status: 500 });
  }

  try {
    const startDate = getObservationStart(range);
    const maturities = Object.keys(TREASURY_SERIES) as TreasuryMaturity[];

    const results = await Promise.all(
      maturities.map(async (maturity) => {
        const config = TREASURY_SERIES[maturity];
        const data = await fetchSeries(config.id, apiKey, startDate);

        const currentValue = data.length > 0 ? data[data.length - 1].value : null;
        const previousValue = data.length > 1 ? data[data.length - 2].value : null;
        const change =
          currentValue !== null && previousValue !== null
            ? parseFloat((currentValue - previousValue).toFixed(2))
            : null;

        return {
          maturity,
          label: config.label,
          currentValue,
          previousValue,
          change,
          data,
        } as TreasurySeriesData;
      })
    );

    const response: TreasuryBundleData = {
      series: results,
      lastUpdated: new Date().toISOString(),
    };

    treasuryCache.set(cacheKey, response);
    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Failed to fetch treasury data" }, { status: 500 });
  }
}
