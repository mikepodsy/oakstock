// Peer-set statistics for the Comparisons page. Pure, so the table, charts and
// heatmap all agree on what "median" and "percentile" mean.

function clean(values: Array<number | null | undefined>): number[] {
  return values.filter((v): v is number => v != null && Number.isFinite(v));
}

export function median(values: Array<number | null | undefined>): number | null {
  const v = clean(values).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function mean(values: Array<number | null | undefined>): number | null {
  const v = clean(values);
  if (v.length === 0) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
}

/**
 * Where `value` sits within `values`, 0 (lowest) … 1 (highest). Ties count
 * half, so a value equal to every other one lands at 0.5. Null when there's
 * nothing to rank against.
 */
export function percentileRank(
  value: number | null | undefined,
  values: Array<number | null | undefined>
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const v = clean(values);
  if (v.length < 2) return null;
  let below = 0;
  let equal = 0;
  for (const x of v) {
    if (x < value) below++;
    else if (x === value) equal++;
  }
  // Exclude the value itself (it is normally a member of `values`).
  const others = v.length - 1;
  const ownEqual = Math.max(equal - 1, 0);
  return (below + ownEqual / 2) / others;
}

/** Target vs a benchmark as a signed fraction: 0.25 = 25% premium. */
export function premium(value: number | null, benchmark: number | null): number | null {
  if (value == null || benchmark == null || benchmark === 0) return null;
  return value / benchmark - 1;
}

export interface Regression {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

/** Ordinary least squares y = slope·x + intercept. Null with < 3 points or no x variance. */
export function ols(points: Array<{ x: number; y: number }>): Regression | null {
  const p = points.filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  const n = p.length;
  if (n < 3) return null;
  const mx = p.reduce((s, pt) => s + pt.x, 0) / n;
  const my = p.reduce((s, pt) => s + pt.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const pt of p) {
    const dx = pt.x - mx;
    const dy = pt.y - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
}
