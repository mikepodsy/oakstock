import type { CompRow } from "@/lib/comps/metrics";
import { METRICS, METRIC_LIST, GROUP_LABELS, type MetricId } from "@/lib/comps/registry";
import { median, percentileRank } from "@/lib/comps/stats";

export const TARGET_COLOR = "var(--green-primary)";
export const PEER_COLOR = "var(--oak-300)";

/** Rows that loaded, in table order. */
export function okRows(rows: CompRow[]): CompRow[] {
  return rows.filter((r) => !r.error);
}

/** Peer median for one metric (target excluded, NM excluded). */
export function peerMedian(rows: CompRow[], target: string, id: MetricId): number | null {
  return median(okRows(rows).filter((r) => r.ticker !== target).map((r) => r.values[id]));
}

/**
 * 0 (worst) … 1 (best) for heatmap shading, using the metric's direction.
 * Null when the metric has no direction or the value can't be ranked.
 */
export function goodness(rows: CompRow[], row: CompRow, id: MetricId): number | null {
  const dir = METRICS[id].direction;
  if (!dir) return null;
  const p = percentileRank(row.values[id], okRows(rows).map((r) => r.values[id]));
  if (p == null) return null;
  return dir === "lower" ? 1 - p : p;
}

/** Background for a heatmap cell: red (bad) → transparent (middle) → green (good). */
export function heatColor(score: number | null): string | undefined {
  if (score == null) return undefined;
  const strength = Math.abs(score - 0.5) * 2; // 0 at the median, 1 at the extremes
  const pct = Math.round(strength * 22);
  if (pct < 3) return undefined;
  const base = score >= 0.5 ? "var(--green-primary)" : "var(--red-primary)";
  return `color-mix(in srgb, ${base} ${pct}%, transparent)`;
}


export const GROUPED_METRICS = (Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>).map(
  (g) => ({ group: g, label: GROUP_LABELS[g], metrics: METRIC_LIST.filter((m) => m.group === g) })
);
