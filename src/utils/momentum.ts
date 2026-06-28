// Momentum / moving-average cross detection for the Alerts page. Pure functions
// over candle data — no React or charting imports. Reuses the `sma` helper from
// indicators.ts so the Alerts page and the chart compute identical averages.

import { sma } from "@/utils/indicators";
import type { QuestradeCandle } from "@/types";

export type Relation = "above" | "below";

export interface CrossState {
  /** Whether `a` sits above or below `b` on the latest bar. */
  relation: Relation;
  /** True when the relationship flipped on the latest bar (a fresh, same-session cross). */
  crossedThisBar: boolean;
  /** Direction of the fresh cross: "up" = a crossed above b, "down" = below. Null when no fresh cross. */
  direction: "up" | "down" | null;
  /** Bars since the most recent flip (0 = this bar). Null when no flip in the window. */
  sessionsSinceCross: number | null;
}

export interface MomentumStatus {
  ticker: string;
  close: number;
  sma50: number | null;
  sma200: number | null;
  priceVs50: CrossState;
  priceVs200: CrossState;
  /** 50d vs 200d: a fresh "up" cross is a golden cross, "down" is a death cross. */
  cross50v200: CrossState;
  /** (close − sma50) / sma50 × 100. 0 when sma50 is unavailable. */
  distance50Pct: number;
  distance200Pct: number;
}

// Treat exactly-equal as "above" so the sign is well-defined; ties are vanishingly
// rare with floating-point prices and don't meaningfully affect the signal.
const sign = (x: number): 1 | -1 => (x >= 0 ? 1 : -1);

const NEUTRAL: CrossState = {
  relation: "below",
  crossedThisBar: false,
  direction: null,
  sessionsSinceCross: null,
};

/**
 * Compare two equal-length, time-aligned series (oldest → newest) and describe
 * their crossing relationship on the latest bar. `a` and `b` must already be
 * aligned to the same bars; callers handle alignment.
 */
export function crossState(a: number[], b: number[]): CrossState {
  const n = Math.min(a.length, b.length);
  if (n === 0) return NEUTRAL;

  const diff = (i: number) => a[i] - b[i];
  const last = diff(n - 1);
  const relation: Relation = last >= 0 ? "above" : "below";

  if (n < 2) {
    return { relation, crossedThisBar: false, direction: null, sessionsSinceCross: null };
  }

  // Walk back from the latest bar to the most recent sign flip.
  let sessionsSinceCross: number | null = null;
  for (let i = n - 1; i >= 1; i--) {
    if (sign(diff(i)) !== sign(diff(i - 1))) {
      sessionsSinceCross = n - 1 - i;
      break;
    }
  }

  const crossedThisBar = sessionsSinceCross === 0;
  const direction = crossedThisBar ? (last >= 0 ? "up" : "down") : null;

  return { relation, crossedThisBar, direction, sessionsSinceCross };
}

/** How many trading days back still counts as a "recent" cross. */
export const RECENT_CROSS_WINDOW = 5;

/**
 * Direction of a recent price-vs-MA cross within `window` sessions, else null.
 * "up" = price rose above the MA, "down" = price fell below it. Derived from the
 * current `relation` (the most-recent flip is the only one tracked), so it works
 * for any cross in the window — unlike `CrossState.direction`, which is only set
 * for same-bar crosses.
 */
export function recentCrossDirection(
  cross: CrossState,
  window: number = RECENT_CROSS_WINDOW
): "up" | "down" | null {
  if (cross.sessionsSinceCross === null || cross.sessionsSinceCross > window) return null;
  return cross.relation === "above" ? "up" : "down";
}

/** Tail of `values` aligned to the last `len` bars. */
function tail(values: number[], len: number): number[] {
  return len >= values.length ? values : values.slice(values.length - len);
}

/**
 * Evaluate price-vs-50d, price-vs-200d, and 50d-vs-200d momentum for one ticker.
 * `sma()` returns points starting at index period−1 and ending on the latest
 * candle, so the trailing slices of each series line up bar-for-bar.
 */
export function evaluateMomentum(
  ticker: string,
  candles: QuestradeCandle[]
): MomentumStatus {
  const closes = candles.map((c) => c.close);
  const close = closes.length > 0 ? closes[closes.length - 1] : 0;

  const sma50Pts = sma(candles, 50).map((p) => p.value);
  const sma200Pts = sma(candles, 200).map((p) => p.value);

  const sma50 = sma50Pts.length > 0 ? sma50Pts[sma50Pts.length - 1] : null;
  const sma200 = sma200Pts.length > 0 ? sma200Pts[sma200Pts.length - 1] : null;

  const priceVs50 =
    sma50Pts.length > 0
      ? crossState(tail(closes, sma50Pts.length), sma50Pts)
      : NEUTRAL;

  const priceVs200 =
    sma200Pts.length > 0
      ? crossState(tail(closes, sma200Pts.length), sma200Pts)
      : NEUTRAL;

  // Align the 50d series to the (shorter) 200d series before comparing.
  const cross50v200 =
    sma200Pts.length > 0 && sma50Pts.length > 0
      ? crossState(tail(sma50Pts, sma200Pts.length), sma200Pts)
      : NEUTRAL;

  return {
    ticker,
    close,
    sma50,
    sma200,
    priceVs50,
    priceVs200,
    cross50v200,
    distance50Pct: sma50 ? ((close - sma50) / sma50) * 100 : 0,
    distance200Pct: sma200 ? ((close - sma200) / sma200) * 100 : 0,
  };
}
