import type {
  AnalystData,
  AnalystDistribution,
  AnalystPriceTarget,
  CashFlowPeriod,
  EarningsSurprise,
  EpsPeriod,
} from "@/types";
import { buildFirmRatings, type RawGradeRow } from "./analystFirms";

/**
 * Normalises Yahoo's analyst modules into the shape the UI wants.
 *
 * Kept pure and separate from the route so the assembly — which is fiddly,
 * especially the EPS series — is testable without network access. The input
 * types are deliberately loose rather than yahoo-finance2's own: every field
 * here is optional in practice, and coupling to that library's generated types
 * would make this break on each of its releases.
 */

export interface RawAnalystInput {
  financialData?: {
    currentPrice?: number | null;
    targetHighPrice?: number | null;
    targetLowPrice?: number | null;
    targetMeanPrice?: number | null;
    targetMedianPrice?: number | null;
    recommendationMean?: number | null;
    numberOfAnalystOpinions?: number | null;
    financialCurrency?: string | null;
  } | null;
  recommendationTrend?: {
    trend?: {
      period?: string;
      strongBuy?: number | null;
      buy?: number | null;
      hold?: number | null;
      sell?: number | null;
      strongSell?: number | null;
    }[];
  } | null;
  earnings?: {
    earningsChart?: {
      quarterly?: {
        date?: string;
        actual?: number | null;
        estimate?: number | null;
      }[];
    } | null;
  } | null;
  earningsTrend?: {
    trend?: {
      period?: string;
      endDate?: string | Date | null;
      earningsEstimate?: { avg?: number | null } | null;
    }[];
  } | null;
  upgradeDowngradeHistory?: {
    history?: RawGradeRow[];
  } | null;
  /** Annual diluted EPS from the fundamentals time series, oldest first. */
  annualEps?: { year: number; eps: number | null }[];
  /** Cash-flow rows from the fundamentals time series, either order. */
  cashFlow?: {
    annual?: RawCashFlowRow[];
    quarterly?: RawCashFlowRow[];
  };
  /** Deep beat/miss history, either order. Optional — Yahoo backs it up. */
  earningsSurprises?: RawEarningsSurpriseRow[];
}

/** One row of FMP's per-symbol earnings history. */
export interface RawEarningsSurpriseRow {
  /** Announcement date, not the period end. */
  date: string;
  epsActual?: number | null;
  epsEstimated?: number | null;
}

/** One period of the cash flow statement, straight off the time series. */
export interface RawCashFlowRow {
  /** Period end date. */
  date: string | Date;
  freeCashFlow?: number | null;
  operatingCashFlow?: number | null;
  capex?: number | null;
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** `3Q2026` for the calendar quarter a period ends in. */
export function quarterLabel(date: Date): string {
  return `${Math.floor(date.getUTCMonth() / 3) + 1}Q${date.getUTCFullYear()}`;
}

/** `3Q2026` → 20263, so quarters sort chronologically across year boundaries. */
function quarterSortKey(label: string): number {
  const m = /^(\d)Q(\d{4})$/.exec(label);
  return m ? Number(m[2]) * 10 + Number(m[1]) : 0;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildTarget(
  fin: RawAnalystInput["financialData"]
): AnalystPriceTarget | null {
  const mean = num(fin?.targetMeanPrice);
  const high = num(fin?.targetHighPrice);
  const low = num(fin?.targetLowPrice);
  // Without a high/low there's no range to plot and no forecast cone to draw,
  // so a bare mean isn't enough to call this a price target.
  if (mean == null || high == null || low == null) return null;

  return {
    mean,
    median: num(fin?.targetMedianPrice),
    high,
    low,
    analystCount: num(fin?.numberOfAnalystOpinions),
  };
}

function buildDistribution(
  trend: RawAnalystInput["recommendationTrend"]
): AnalystDistribution | null {
  const rows = trend?.trend ?? [];
  // "0m" is the current month; fall back to whatever is first if it's absent.
  const row = rows.find((r) => r.period === "0m") ?? rows[0];
  if (!row) return null;

  const dist: AnalystDistribution = {
    strongBuy: num(row.strongBuy) ?? 0,
    buy: num(row.buy) ?? 0,
    hold: num(row.hold) ?? 0,
    sell: num(row.sell) ?? 0,
    strongSell: num(row.strongSell) ?? 0,
  };

  const total =
    dist.strongBuy + dist.buy + dist.hold + dist.sell + dist.strongSell;
  // Yahoo returns a row of zeroes for uncovered symbols. That's no coverage,
  // not a unanimous "hold".
  return total > 0 ? dist : null;
}

/** Forward estimates keyed by period, e.g. `0y` → { label: "2026", avg }. */
function estimatesByPeriod(
  trend: RawAnalystInput["earningsTrend"]
): Map<string, { label: string; avg: number; date: Date }> {
  const out = new Map<string, { label: string; avg: number; date: Date }>();

  for (const row of trend?.trend ?? []) {
    const avg = num(row.earningsEstimate?.avg);
    const date = toDate(row.endDate);
    // +5y carries a long-run growth estimate with no end date — nothing to
    // place it on an axis with, so it's dropped.
    if (!row.period || avg == null || !date) continue;

    const isAnnual = row.period.endsWith("y");
    out.set(row.period, {
      label: isAnnual ? String(date.getUTCFullYear()) : quarterLabel(date),
      avg,
      date,
    });
  }

  return out;
}

function buildAnnualEps(
  annualEps: RawAnalystInput["annualEps"],
  estimates: ReturnType<typeof estimatesByPeriod>
): EpsPeriod[] {
  const byLabel = new Map<string, EpsPeriod>();

  for (const row of annualEps ?? []) {
    const eps = num(row.eps);
    // A year with no diluted EPS on file is a gap in the filing history, not a
    // zero — leaving it out beats drawing a bar at the baseline.
    if (eps == null) continue;
    byLabel.set(String(row.year), {
      label: String(row.year),
      actual: eps,
      estimate: null,
    });
  }

  for (const period of ["0y", "+1y"]) {
    const est = estimates.get(period);
    if (!est) continue;
    const existing = byLabel.get(est.label);
    if (existing) {
      // The year has already reported but still carries a consensus — show both.
      existing.estimate = est.avg;
    } else {
      byLabel.set(est.label, {
        label: est.label,
        actual: null,
        estimate: est.avg,
      });
    }
  }

  return [...byLabel.values()].sort((a, b) => Number(a.label) - Number(b.label));
}

function buildQuarterlyEps(
  earnings: RawAnalystInput["earnings"],
  estimates: ReturnType<typeof estimatesByPeriod>
): EpsPeriod[] {
  const byLabel = new Map<string, EpsPeriod>();

  for (const row of earnings?.earningsChart?.quarterly ?? []) {
    if (!row.date) continue;
    byLabel.set(row.date, {
      label: row.date,
      actual: num(row.actual),
      estimate: num(row.estimate),
    });
  }

  for (const period of ["0q", "+1q"]) {
    const est = estimates.get(period);
    // A reported quarter keeps the estimate it was actually measured against,
    // so a freshly-landed 0q must not overwrite it.
    if (!est || byLabel.has(est.label)) continue;
    byLabel.set(est.label, {
      label: est.label,
      actual: null,
      estimate: est.avg,
    });
  }

  return [...byLabel.values()].sort(
    (a, b) => quarterSortKey(a.label) - quarterSortKey(b.label)
  );
}

/** Most recent periods kept per granularity — enough shape without crowding. */
const CASH_FLOW_LIMIT = { annual: 10, quarterly: 12 } as const;

/**
 * Free cash flow bars, oldest first and capped to the most recent periods.
 *
 * A period with no FCF on file is dropped rather than zeroed: a zero bar reads
 * as "this company burned exactly nothing", which is never what a gap means.
 */
export function buildCashFlow(
  rows: RawCashFlowRow[] | undefined,
  granularity: "annual" | "quarterly"
): CashFlowPeriod[] {
  const byLabel = new Map<string, CashFlowPeriod>();

  for (const row of rows ?? []) {
    const date = toDate(row.date);
    const fcf = num(row.freeCashFlow);
    if (!date || fcf == null) continue;

    const label =
      granularity === "annual"
        ? String(date.getUTCFullYear())
        : quarterLabel(date);

    byLabel.set(label, {
      label,
      freeCashFlow: fcf,
      operatingCashFlow: num(row.operatingCashFlow),
      capex: num(row.capex),
    });
  }

  const sortKey =
    granularity === "annual"
      ? (p: CashFlowPeriod) => Number(p.label)
      : (p: CashFlowPeriod) => quarterSortKey(p.label);

  return [...byLabel.values()]
    .sort((a, b) => sortKey(a) - sortKey(b))
    .slice(-CASH_FLOW_LIMIT[granularity]);
}

/**
 * Quarters of beat/miss history kept — 10 years, which is past the point
 * anyone reads a dot chart and well past what any free source publishes.
 */
const SURPRISE_LIMIT = 40;

/**
 * Beat/miss history, oldest first.
 *
 * Keyed by announcement date rather than fiscal quarter, because the source
 * gives the announcement and the two can't be bridged reliably: NVDA reports
 * 24 days after its quarter ends and Lucid 55, so any fixed offset from report
 * date back to period end mislabels one of them — and two reports landing on
 * the same guessed quarter silently drop one. The axis says when the result
 * was published, which is a fact the data actually carries.
 *
 * `fallback` is the Yahoo quarterly EPS series, used whole when the deep
 * history is missing — no FMP key configured, a symbol it doesn't cover, a
 * failed request. Four quarters beats an empty card. Those rows are already
 * keyed by fiscal quarter, so they keep those labels.
 */
export function buildEarningsSurprises(
  rows: RawEarningsSurpriseRow[] | undefined,
  fallback: EpsPeriod[]
): EarningsSurprise[] {
  const byDate = new Map<string, EarningsSurprise>();

  for (const row of rows ?? []) {
    const reported = toDate(row.date);
    const actual = num(row.epsActual);
    const estimate = num(row.epsEstimated);
    if (!reported) continue;

    // No consensus means nothing to beat or miss. Dropping these isn't just
    // tidiness: the pre-coverage years of a recent listing carry wild
    // per-share numbers that flatten every scored quarter against the axis.
    if (estimate == null) continue;

    const iso = reported.toISOString().split("T")[0];
    byDate.set(iso, { label: iso, reportDate: iso, actual, estimate });
  }

  if (byDate.size === 0) {
    return fallback.map((p) => ({
      label: p.label,
      reportDate: null,
      actual: p.actual,
      estimate: p.estimate,
    }));
  }

  // ISO dates sort lexicographically, which is why they're kept as strings.
  return [...byDate.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-SURPRISE_LIMIT);
}

export function buildAnalystData(
  ticker: string,
  raw: RawAnalystInput
): AnalystData {
  const fin = raw.financialData;
  const estimates = estimatesByPeriod(raw.earningsTrend);
  const quarterlyEps = buildQuarterlyEps(raw.earnings, estimates);

  return {
    ticker,
    currency: fin?.financialCurrency ?? null,
    currentPrice: num(fin?.currentPrice),
    consensusMean: num(fin?.recommendationMean),
    distribution: buildDistribution(raw.recommendationTrend),
    target: buildTarget(fin),
    eps: {
      annual: buildAnnualEps(raw.annualEps, estimates),
      quarterly: quarterlyEps,
    },
    freeCashFlow: {
      annual: buildCashFlow(raw.cashFlow?.annual, "annual"),
      quarterly: buildCashFlow(raw.cashFlow?.quarterly, "quarterly"),
    },
    earningsSurprises: buildEarningsSurprises(
      raw.earningsSurprises,
      quarterlyEps
    ),
    firms: buildFirmRatings(raw.upgradeDowngradeHistory?.history),
  };
}
