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

// Weeks of history pulled to compute the 3-year net-positioning index (COT Index).
// CFTC publishes weekly, so 156 ≈ 3 years. Only a single number per category is
// derived from this window — the 52-week chart payload is unaffected.
const INDEX_WEEKS = 156;

// Records pulled from CFTC: enough to compute a rolling 3-year index for every one
// of the 52 historical weeks (so past reports show their own index), i.e. 52 + 156.
const FETCH_WEEKS = HISTORY_WEEKS + INDEX_WEEKS;

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
    label: "Russell 2000",
    cftcName: "RUSSELL E-MINI - CHICAGO MERCANTILE EXCHANGE",
    reportType: "tff",
    group: "Indices",
  },
  {
    label: "VIX",
    cftcName: "VIX FUTURES - CBOE FUTURES EXCHANGE",
    reportType: "tff",
    group: "Indices",
  },
  {
    // CBOT renamed the consolidated E-mini Dow series; "DJIA Consolidated" is the
    // current one (the older "DOW JONES INDUSTRIAL AVG- x $5" stopped in 2022).
    label: "Dow Jones",
    cftcName: "DJIA Consolidated - CHICAGO BOARD OF TRADE",
    reportType: "tff",
    group: "Indices",
  },
  {
    // Yen-denominated Nikkei is the actively-updating, more liquid CME series;
    // the USD-denominated "NIKKEI STOCK AVERAGE" went stale in early 2026.
    label: "Nikkei 225",
    cftcName: "NIKKEI STOCK AVERAGE YEN DENOM - CHICAGO MERCANTILE EXCHANGE",
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
    // ICE renamed this from "U.S. DOLLAR INDEX" (which stopped updating in 2022)
    // to "USD INDEX" — verified current against the TFF + legacy datasets.
    label: "US Dollar Index",
    cftcName: "USD INDEX - ICE FUTURES U.S.",
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
  {
    label: "Brent Crude",
    cftcName: "BRENT LAST DAY - NEW YORK MERCANTILE EXCHANGE",
    reportType: "disagg",
    group: "Energy",
  },
  {
    label: "Natural Gas",
    cftcName: "NAT GAS NYME - NEW YORK MERCANTILE EXCHANGE",
    reportType: "disagg",
    group: "Energy",
  },
  // ── Bonds (US Treasuries — CBOT renamed these to the short "UST …" form) ──
  {
    label: "30-Year T-Bond",
    cftcName: "UST BOND - CHICAGO BOARD OF TRADE",
    reportType: "tff",
    group: "Bonds",
  },
  {
    label: "10-Year T-Note",
    cftcName: "UST 10Y NOTE - CHICAGO BOARD OF TRADE",
    reportType: "tff",
    group: "Bonds",
  },
  {
    label: "5-Year T-Note",
    cftcName: "UST 5Y NOTE - CHICAGO BOARD OF TRADE",
    reportType: "tff",
    group: "Bonds",
  },
  {
    label: "2-Year T-Note",
    cftcName: "UST 2Y NOTE - CHICAGO BOARD OF TRADE",
    reportType: "tff",
    group: "Bonds",
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

// Places the current value (values[0]) within the min/max range of the series,
// scaled 0–100. ≥80 = near the high, ≤20 = near the low. Returns null when the
// series is empty or the range is flat.
function rangeIndex(values: number[]): number | null {
  if (values.length === 0) return null;
  const current = values[0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return null;
  const idx = ((current - min) / (max - min)) * 100;
  return Math.min(Math.max(idx, 0), 100);
}

// COT Index: places the current net position within its 3-year high/low range,
// scaled 0–100. ≥80 = near the 3yr high (bullish), ≤20 = near the 3yr low (bearish).
function cotIndex(records: Record<string, unknown>[], cols: ColPair): number | null {
  const nets = records
    .slice(0, INDEX_WEEKS)
    .map((rec) => num(rec, cols.long) - num(rec, cols.short));
  return rangeIndex(nets);
}

// Open Interest Index: places current open interest within its 3-year high/low
// range, scaled 0–100. ≥80 = near the 3yr high, ≤20 = near the 3yr low.
function oiIndex(records: Record<string, unknown>[]): number | null {
  const ois = records.slice(0, INDEX_WEEKS).map((rec) => num(rec, "open_interest_all"));
  return rangeIndex(ois);
}

// Per-category open-interest index: the category's gross position (longs + shorts,
// i.e. its footprint in open interest) within its own 3-year high/low range, 0–100.
function grossIndex(records: Record<string, unknown>[], cols: ColPair): number | null {
  const gross = records
    .slice(0, INDEX_WEEKS)
    .map((rec) => num(rec, cols.long) + num(rec, cols.short));
  return rangeIndex(gross);
}

// Build the full category set for the week at index `i` (0 = newest). netChange is
// vs the prior week (records[i+1]); the index uses the trailing 3-year window from
// that week (records.slice(i)). Lets any historical week render like the latest one.
function buildCategoriesAt(
  records: Record<string, unknown>[],
  i: number,
  categoryDefs: { name: string; cols: ColPair }[]
): CotCategory[] {
  const latest = records[i];
  const prev = records[i + 1] ?? null;
  const window = records.slice(i);
  return categoryDefs.map(({ name, cols }) => {
    const longs  = num(latest, cols.long);
    const shorts = num(latest, cols.short);
    const net    = longs - shorts;
    const prevNet = prev ? num(prev, cols.long) - num(prev, cols.short) : 0;
    return {
      name,
      longs,
      shorts,
      net,
      netChange: net - prevNet,
      index: cotIndex(window, cols),
      openInterestIndex: grossIndex(window, cols),
    };
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
    .map((_, i) => ({
      reportDate: reportDateOf(records[i]),
      categories: buildCategoriesAt(records, i, categoryDefs),
      openInterest: num(records[i], "open_interest_all"),
      openInterestIndex: oiIndex(records.slice(i)),
    }))
    .reverse();
}

// Pull up to FETCH_WEEKS (~4 years) of records for a given dataset and CFTC market
// name, newest-first. The 52-week chart uses the first slice; the deeper tail feeds
// the rolling 3-year COT index for each of those weeks. Returns [] on any failure.
async function fetchRecords(
  dataset: string,
  cftcName: string,
  label: string
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    $where: `market_and_exchange_names='${cftcName}'`,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: String(FETCH_WEEKS),
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
  return {
    categories: buildCategoriesAt(records, 0, categoryDefs),
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
    openInterest: num(results[0], "open_interest_all"),
    openInterestIndex: oiIndex(results),
    legacy,
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET() {
  // Versioned key — bump when the response shape changes so long-lived caches
  // don't serve stale-shaped data after a deploy.
  const CACHE_KEY = "cot-all-v9";
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
