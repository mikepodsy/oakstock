import type {
  AnalystData,
  AnalystDistribution,
  AnalystPriceTarget,
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

export function buildAnalystData(
  ticker: string,
  raw: RawAnalystInput
): AnalystData {
  const fin = raw.financialData;
  const estimates = estimatesByPeriod(raw.earningsTrend);

  return {
    ticker,
    currency: fin?.financialCurrency ?? null,
    currentPrice: num(fin?.currentPrice),
    consensusMean: num(fin?.recommendationMean),
    distribution: buildDistribution(raw.recommendationTrend),
    target: buildTarget(fin),
    eps: {
      annual: buildAnnualEps(raw.annualEps, estimates),
      quarterly: buildQuarterlyEps(raw.earnings, estimates),
    },
    firms: buildFirmRatings(raw.upgradeDowngradeHistory?.history),
  };
}
