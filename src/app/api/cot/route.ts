import { NextResponse } from "next/server";
import { cotCache } from "@/lib/cache";
import type { CotReport, CotCategory, CotInstrument, CotReportType } from "@/types";

// ─── Instrument Config (add more here to extend) ──────────────────────────────
const INSTRUMENTS: CotInstrument[] = [
  {
    label: "S&P 500",
    cftcName: "S&P 500 Consolidated - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
  },
  {
    label: "Nasdaq 100",
    cftcName: "NASDAQ-100 Consolidated - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
  },
  {
    label: "Gold",
    cftcName: "GOLD - COMMODITY EXCHANGE INC.",
    reportType: "disagg",
  },
  {
    label: "Crude Oil WTI",
    cftcName: "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE",
    reportType: "disagg",
  },
];

// ─── CFTC Column Maps ─────────────────────────────────────────────────────────
type ColPair = { long: string; short: string };

const TFF_CATEGORIES: { name: string; cols: ColPair }[] = [
  { name: "Asset Manager / Institutional", cols: { long: "asset_mgr_positions_long", short: "asset_mgr_positions_short" } },
  { name: "Leveraged Funds",               cols: { long: "lev_money_positions_long", short: "lev_money_positions_short" } },
  { name: "Dealer / Intermediary",         cols: { long: "dealer_positions_long_all", short: "dealer_positions_short_all" } },
  { name: "Other Reportables",             cols: { long: "other_rept_positions_long", short: "other_rept_positions_short" } },
  { name: "Retail / Non-Reportable",       cols: { long: "nonrept_positions_long_all", short: "nonrept_positions_short_all" } },
];

const DISAGG_CATEGORIES: { name: string; cols: ColPair }[] = [
  // CFTC's actual field name has a double underscore in swap__positions_short_all — not a typo
  { name: "Swap Dealers",        cols: { long: "swap_positions_long_all",    short: "swap__positions_short_all" } },
  { name: "Managed Money",       cols: { long: "m_money_positions_long_all", short: "m_money_positions_short_all" } },
  { name: "Producer / Merchant", cols: { long: "prod_merc_positions_long",   short: "prod_merc_positions_short" } },
  { name: "Other Reportables",   cols: { long: "other_rept_positions_long",  short: "other_rept_positions_short" } },
  { name: "Retail / Non-Reportable", cols: { long: "nonrept_positions_long_all", short: "nonrept_positions_short_all" } },
];

// Socrata dataset IDs on publicreporting.cftc.gov
const DATASET: Record<CotReportType, string> = {
  tff:    "gpe5-46if",
  disagg: "72hh-3qpy",
};

const CFTC_BASE = "https://publicreporting.cftc.gov/resource";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function num(record: Record<string, unknown>, col: string): number {
  const v = record[col];
  return typeof v === "number" ? v : Number(v ?? 0);
}

function buildCategories(
  latest: Record<string, unknown>,
  prev: Record<string, unknown> | null,
  categoryDefs: { name: string; cols: ColPair }[]
): CotCategory[] {
  return categoryDefs.map(({ name, cols }) => {
    const longs  = num(latest, cols.long);
    const shorts = num(latest, cols.short);
    const net    = longs - shorts;
    const prevNet = prev ? num(prev, cols.long) - num(prev, cols.short) : 0;
    return { name, longs, shorts, net, netChange: net - prevNet };
  });
}

async function fetchInstrument(instrument: CotInstrument): Promise<CotReport | null> {
  const dataset = DATASET[instrument.reportType];
  const categoryDefs = instrument.reportType === "tff" ? TFF_CATEGORIES : DISAGG_CATEGORIES;
  const params = new URLSearchParams({
    $where: `market_and_exchange_names='${instrument.cftcName}'`,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: "2",
  });
  const url = `${CFTC_BASE}/${dataset}.json?${params}`;

  const res = await fetch(url, { cache: "no-store" }); // caching handled by TTLCache
  if (!res.ok) {
    console.error(`[COT] CFTC fetch failed for ${instrument.label}: ${res.status}`);
    return null;
  }

  const results = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(results) || results.length === 0) {
    console.error(`[COT] No records found for ${instrument.label}`);
    return null;
  }

  const latest = results[0];
  const prev   = results[1] ?? null;

  return {
    instrument: instrument.label,
    // Socrata returns ISO timestamps like "2026-06-02T00:00:00.000"
    reportDate: String(latest.report_date_as_yyyy_mm_dd ?? "").slice(0, 10),
    reportType: instrument.reportType,
    categories: buildCategories(latest, prev, categoryDefs),
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET() {
  const CACHE_KEY = "cot-all";
  const cached = cotCache.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const results = await Promise.allSettled(INSTRUMENTS.map(fetchInstrument));
  const reports: CotReport[] = results
    .filter((r): r is PromiseFulfilledResult<CotReport> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);

  cotCache.set(CACHE_KEY, reports as unknown[]);
  return NextResponse.json(reports, { headers: CACHE_HEADERS });
}
