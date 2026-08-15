import type { AnalystDistribution } from "@/types";
import { ratingFromScore, type Rating } from "./rating";

/**
 * Presentation maths for the analyst rating. Pure and React-free, mirroring
 * technicalRating.ts — the components only lay these results out.
 */

/** One bar in the recommendation breakdown. */
export interface DistributionRow {
  label: string;
  count: number;
  /** 0…1 against the biggest bucket, for the bar's width. */
  fraction: number;
  color: string;
}

const BUCKETS: {
  key: keyof AnalystDistribution;
  label: string;
  color: string;
}[] = [
  { key: "strongBuy", label: "Strong buy", color: "var(--green-primary)" },
  { key: "buy", label: "Buy", color: "var(--green-primary)" },
  { key: "hold", label: "Hold", color: "var(--text-tertiary)" },
  { key: "sell", label: "Sell", color: "var(--red-primary)" },
  { key: "strongSell", label: "Strong sell", color: "var(--red-primary)" },
];

/** Weight per bucket when deriving a score from raw counts. */
const BUCKET_WEIGHT: Record<keyof AnalystDistribution, number> = {
  strongBuy: 1,
  buy: 0.5,
  hold: 0,
  sell: -0.5,
  strongSell: -1,
};

/**
 * Yahoo's `recommendationMean` (1 = strong buy … 5 = strong sell) onto the
 * gauge's −1…1. Both scales are linear and evenly spaced, so this is just a
 * flip and a rescale: mean 2 ("Buy") lands on 0.5, the top of the Buy band.
 */
export function consensusScore(mean: number | null | undefined): number | null {
  if (mean == null || !Number.isFinite(mean)) return null;
  return Math.max(-1, Math.min(1, (3 - mean) / 2));
}

export function distributionTotal(
  dist: AnalystDistribution | null | undefined
): number {
  if (!dist) return 0;
  return BUCKETS.reduce((sum, b) => sum + (dist[b.key] || 0), 0);
}

/**
 * Score straight from the recommendation counts — the fallback for symbols
 * where Yahoo returns a breakdown but no `recommendationMean`.
 *
 * null rather than 0 when nobody covers the name: an uncovered stock isn't a
 * neutral one, and rendering it as "Neutral" would invent a consensus.
 */
export function distributionScore(
  dist: AnalystDistribution | null | undefined
): number | null {
  const total = distributionTotal(dist);
  if (!dist || total === 0) return null;

  const weighted = BUCKETS.reduce(
    (sum, b) => sum + (dist[b.key] || 0) * BUCKET_WEIGHT[b.key],
    0
  );
  return weighted / total;
}

/** The consensus mean if there is one, else derived from the counts. */
export function analystScore(
  mean: number | null | undefined,
  dist: AnalystDistribution | null | undefined
): number | null {
  return consensusScore(mean) ?? distributionScore(dist);
}

export function analystRating(
  mean: number | null | undefined,
  dist: AnalystDistribution | null | undefined
): Rating | null {
  const score = analystScore(mean, dist);
  return score == null ? null : ratingFromScore(score);
}

/**
 * Bars for the breakdown, strongest buy first so they read down in the same
 * direction the gauge reads across.
 *
 * Widths are scaled against the largest bucket rather than the total: consensus
 * is usually lopsided, and scaling by total leaves every bar stubby.
 */
export function distributionRows(
  dist: AnalystDistribution | null | undefined
): DistributionRow[] {
  if (!dist || distributionTotal(dist) === 0) return [];

  const max = Math.max(...BUCKETS.map((b) => dist[b.key] || 0));
  return BUCKETS.map((b) => {
    const count = dist[b.key] || 0;
    return {
      label: b.label,
      count,
      fraction: max > 0 ? count / max : 0,
      color: b.color,
    };
  });
}

/** Gap between the mean price target and spot, absolute and fractional. */
export function targetUpside(
  target: number | null | undefined,
  price: number | null | undefined
): { absolute: number; percent: number } | null {
  if (target == null || price == null || !price) return null;
  if (!Number.isFinite(target) || !Number.isFinite(price)) return null;
  return { absolute: target - price, percent: (target - price) / price };
}
