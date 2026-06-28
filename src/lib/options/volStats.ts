// Pure stats for the Volatility Dashboard: IV rank/percentile, VRP percentile,
// rolling averages, and option skew from a chain snapshot.
import type { VolHistoryPoint, VolStats, SkewData, SkewPoint } from "@/types/volatility";
import type { OptionStrikeQuotes } from "@/types/options";

const TRADING_YEAR = 252;

// Fraction of `values` strictly below `current` (0..1), or null if empty.
export function percentile(values: number[], current: number): number | null {
  if (values.length === 0) return null;
  const below = values.filter((v) => v < current).length;
  return below / values.length;
}

// Where `current` sits in the [low, high] range, clamped to [0,1]. null if
// the range is degenerate.
export function ivRank(current: number, low: number, high: number): number | null {
  if (high <= low) return null;
  return Math.min(Math.max((current - low) / (high - low), 0), 1);
}

// Mean of the non-null values, or null if there are none.
export function mean(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

// Build the Section 1 + 4 stat block from the (ascending) history series. The
// year range comes from the dataset when available, else the series min/max.
export function assembleVolStats(
  history: VolHistoryPoint[],
  yearRange: { high: number | null; low: number | null },
): VolStats {
  const ivs = history.map((p) => p.iv).filter((v): v is number => v != null);
  const last = history[history.length - 1];
  const currentIv = last?.iv ?? null;
  const currentHv = last?.hv ?? null;
  const currentVrp = last?.vrp ?? null;

  const yearWindow = lastN(history, TRADING_YEAR);
  const ivWindow = yearWindow.map((p) => p.iv).filter((v): v is number => v != null);
  const vrpWindow = yearWindow.map((p) => p.vrp).filter((v): v is number => v != null);

  const high = yearRange.high ?? (ivs.length ? Math.max(...ivs) : null);
  const low = yearRange.low ?? (ivs.length ? Math.min(...ivs) : null);

  return {
    currentIv,
    currentHv,
    currentVrp,
    ivRank: currentIv != null && high != null && low != null ? ivRank(currentIv, low, high) : null,
    ivPercentile: currentIv != null ? percentile(ivWindow, currentIv) : null,
    avgVrp1y: mean(vrpWindow),
    vrpPercentile: currentVrp != null ? percentile(vrpWindow, currentVrp) : null,
    avg30Iv: mean(lastN(history, 30).map((p) => p.iv)),
    avg90Iv: mean(lastN(history, 90).map((p) => p.iv)),
    yearHighIv: high,
    yearLowIv: low,
  };
}

// Build the skew curve for one expiry from a chain snapshot. Uses the OTM side's
// IV at each strike (puts below spot, calls at/above), and locates the 25-delta
// put/call and ATM marks. Delta is expressed as call-equivalent delta so the
// curve reads left (puts) → right (calls).
export function computeSkew(
  strikes: OptionStrikeQuotes[],
  spot: number | null,
  expiry: string,
): SkewData {
  const sorted = [...strikes].sort((a, b) => a.strike - b.strike);

  const points: SkewPoint[] = sorted.map((s) => {
    const otm = spot != null && s.strike < spot ? s.put : s.call;
    // Map a put's (negative) delta to its call-equivalent for the x-axis.
    const delta =
      otm === s.put && s.put.delta != null ? s.put.delta + 1 : s.call.delta;
    return { strike: s.strike, delta, iv: otm.iv };
  });

  // ATM = strike nearest spot.
  let atmIv: number | null = null;
  if (spot != null) {
    let bestDist = Infinity;
    for (const s of sorted) {
      const d = Math.abs(s.strike - spot);
      const iv = s.strike < spot ? s.put.iv : s.call.iv;
      if (d < bestDist && iv != null) {
        bestDist = d;
        atmIv = iv;
      }
    }
  }

  // 25-delta put (delta ≈ -0.25) and call (delta ≈ +0.25).
  const put25Iv = closestByDelta(sorted, "put", -0.25);
  const call25Iv = closestByDelta(sorted, "call", 0.25);

  return {
    expiry,
    spot,
    points,
    atmIv,
    put25Iv,
    call25Iv,
    putSkew: put25Iv != null && atmIv != null ? put25Iv - atmIv : null,
    callSkew: call25Iv != null && atmIv != null ? call25Iv - atmIv : null,
    riskReversal: put25Iv != null && call25Iv != null ? put25Iv - call25Iv : null,
  };
}

function closestByDelta(
  strikes: OptionStrikeQuotes[],
  side: "put" | "call",
  target: number,
): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const s of strikes) {
    const c = s[side];
    if (c.delta == null || c.iv == null) continue;
    const d = Math.abs(c.delta - target);
    if (d < bestDist) {
      bestDist = d;
      best = c.iv;
    }
  }
  return best;
}
