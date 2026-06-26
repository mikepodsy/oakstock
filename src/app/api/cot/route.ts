import { NextResponse } from "next/server";
import { cotCache } from "@/lib/cache";
import type {
  CotReport,
  CotCategory,
  CotWeek,
  CotInstrument,
  CotReportType,
  CotGroupSet,
} from "@/types";

// Weeks of history exposed for the 52-week positioning chart
const HISTORY_WEEKS = 52;

// ─── Instrument Config (add more here to extend) ──────────────────────────────
const INSTRUMENTS: CotInstrument[] = [
  // ── Indices ──
  {
    label: "S&P 500",
    cftcName: "S&P 500 Consolidated - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
    group: "Indices",
  },
  {
    label: "Nasdaq 100",
    cftcName: "NASDAQ-100 Consolidated - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
    group: "Indices",
  },
  {
    label: "VIX",
    cftcName: "VIX FUTURES - CBOE FUTURES EXCHANGE",
    reportType: "tff",
    group: "Indices",
  },
  // ── Metals ──
  {
    label: "Gold",
    cftcName: "GOLD - COMMODITY EXCHANGE INC.",
    reportType: "disagg",
    group: "Metals",
  },
  {
    label: "Silver",
    cftcName: "SILVER - COMMODITY EXCHANGE INC.",
    reportType: "disagg",
    group: "Metals",
  },
  {
    label: "Copper",
    cftcName: "COPPER- #1 - COMMODITY EXCHANGE INC.",
    reportType: "disagg",
    group: "Metals",
  },
  // ── FX ──
  {
    label: "US Dollar Index",
    cftcName: "U.S. DOLLAR INDEX - ICE FUTURES U.S.",
    reportType: "tff",
    group: "FX",
  },
  {
    label: "Euro",
    cftcName: "EURO FX - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
    group: "FX",
  },
  {
    label: "Japanese Yen",
    cftcName: "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
    group: "FX",
  },
  {
    label: "British Pound",
    cftcName: "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
    group: "FX",
  },
  {
    label: "Canadian Dollar",
    cftcName: "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
    group: "FX",
  },
  // ── Energy ──
  {
    label: "Crude Oil WTI",
    cftcName: "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE",
    reportType: "disagg",
    group: "Energy",
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

// Legacy (Futures-Only) report — the classic Commercial / Non-Commercial split.
// Same market_and_exchange_names values as the tff/disagg datasets.
const LEGACY_CATEGORIES: { name: string; cols: ColPair }[] = [
  { name: "Commercial",       cols: { long: "comm_positions_long_all",    short: "comm_positions_short_all" } },
  { name: "Non-Commercial",   cols: { long: "noncomm_positions_long_all", short: "noncomm_positions_short_all" } },
  { name: "Non-Reportable",   cols: { long: "nonrept_positions_long_all", short: "nonrept_positions_short_all" } },
];

// Socrata dataset IDs on publicreporting.cftc.gov
const DATASET: Record<CotReportType, string> = {
  tff:    "gpe5-46if",
  disagg: "72hh-3qpy",
};

const LEGACY_DATASET = "6dca-aqww";

const CFTC_BASE = "https://publicreporting.cftc.gov/resource";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function num(record: Record<string, unknown>, col: string): number {
  const v = record[col];
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
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

function reportDateOf(record: Record<string, unknown>): string {
  // Socrata returns ISO timestamps like "2026-06-02T00:00:00.000"
  return String(record.report_date_as_yyyy_mm_dd ?? "").slice(0, 10);
}

function buildHistory(
  records: Record<string, unknown>[],
  categoryDefs: { name: string; cols: ColPair }[]
): CotWeek[] {
  // records arrive newest-first; reverse so the chart plots oldest → newest left to right
  return records
    .slice(0, HISTORY_WEEKS)
    .map((rec) => ({
      reportDate: reportDateOf(rec),
      categories: categoryDefs.map(({ name, cols }) => {
        const longs = num(rec, cols.long);
        const shorts = num(rec, cols.short);
        return { name, longs, shorts, net: longs - shorts };
      }),
    }))
    .reverse();
}

// Pull up to 53 weeks (52 history + 1 for week-over-week change) of records for a
// given dataset and CFTC market name, newest-first. Returns [] on any failure.
async function fetchRecords(
  dataset: string,
  cftcName: string,
  label: string
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    $where: `market_and_exchange_names='${cftcName}'`,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: String(HISTORY_WEEKS + 1),
  });
  const url = `${CFTC_BASE}/${dataset}.json?${params}`;

  const res = await fetch(url, { cache: "no-store" }); // caching handled by TTLCache
  if (!res.ok) {
    console.error(`[COT] CFTC fetch failed for ${label} (${dataset}): ${res.status}`);
    return [];
  }

  const results = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(results)) return [];
  return results;
}

// Build the category + history pair for a set of column definitions.
function buildGroupSet(
  records: Record<string, unknown>[],
  categoryDefs: { name: string; cols: ColPair }[]
): CotGroupSet {
  const latest = records[0];
  const prev = records[1] ?? null;
  return {
    categories: buildCategories(latest, prev, categoryDefs),
    history: buildHistory(records, categoryDefs),
  };
}

async function fetchInstrument(instrument: CotInstrument): Promise<CotReport | null> {
  const dataset = DATASET[instrument.reportType];
  const categoryDefs = instrument.reportType === "tff" ? TFF_CATEGORIES : DISAGG_CATEGORIES;

  // Detailed (tff/disagg) and legacy reports share the same market name, so fetch
  // both in parallel. Legacy is best-effort — its absence must not drop the instrument.
  const [results, legacyRecords] = await Promise.all([
    fetchRecords(dataset, instrument.cftcName, instrument.label),
    fetchRecords(LEGACY_DATASET, instrument.cftcName, `${instrument.label} (legacy)`),
  ]);

  if (results.length === 0) {
    console.error(`[COT] No records found for ${instrument.label}`);
    return null;
  }

  const detailed = buildGroupSet(results, categoryDefs);
  const legacy =
    legacyRecords.length > 0 ? buildGroupSet(legacyRecords, LEGACY_CATEGORIES) : null;

  return {
    instrument: instrument.label,
    group: instrument.group,
    reportDate: reportDateOf(results[0]),
    reportType: instrument.reportType,
    categories: detailed.categories,
    history: detailed.history,
    legacy,
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET() {
  // Versioned key — bump when the response shape changes so long-lived caches
  // don't serve stale-shaped data after a deploy.
  const CACHE_KEY = "cot-all-v2";
  const cached = cotCache.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const results = await Promise.allSettled(INSTRUMENTS.map(fetchInstrument));

  // Log any rejections so transient failures are visible in server logs
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[COT] fetchInstrument rejected for ${INSTRUMENTS[i].label}:`, r.reason);
    }
  });

  const reports: CotReport[] = results
    .filter((r): r is PromiseFulfilledResult<CotReport> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);

  if (reports.length === 0) {
    // Total outage — don't pin an empty response in any cache layer
    return NextResponse.json(reports, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (reports.length < INSTRUMENTS.length) {
    // Partial — return what we have but let next request retry the failed instruments
    return NextResponse.json(reports, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // All instruments succeeded — safe to cache for 24h
  cotCache.set(CACHE_KEY, reports as unknown[]);
  return NextResponse.json(reports, { headers: CACHE_HEADERS });
}
