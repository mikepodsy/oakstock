import { describe, it, expect } from "vitest";
import { percentile, ivRank, mean, assembleVolStats, computeSkew } from "./volStats";
import type { VolHistoryPoint } from "@/types/volatility";
import type { OptionStrikeQuotes, ContractQuote } from "@/types/options";

describe("percentile", () => {
  it("is the fraction of values strictly below current", () => {
    expect(percentile([1, 2, 3, 4], 3)).toBeCloseTo(0.5, 6); // 1,2 below
  });
  it("is 0 when current is the min", () => {
    expect(percentile([5, 6, 7], 5)).toBe(0);
  });
  it("is 1 when current exceeds all", () => {
    expect(percentile([1, 2, 3], 9)).toBe(1);
  });
  it("returns null for an empty set", () => {
    expect(percentile([], 1)).toBeNull();
  });
});

describe("ivRank", () => {
  it("places current within the high/low range", () => {
    expect(ivRank(0.3, 0.1, 0.5)).toBeCloseTo(0.5, 6);
  });
  it("clamps to [0,1]", () => {
    expect(ivRank(0.6, 0.1, 0.5)).toBe(1);
    expect(ivRank(0.05, 0.1, 0.5)).toBe(0);
  });
  it("returns null when range is degenerate", () => {
    expect(ivRank(0.3, 0.2, 0.2)).toBeNull();
  });
});

describe("mean", () => {
  it("averages, ignoring nulls", () => {
    expect(mean([1, null, 3])).toBe(2);
  });
  it("returns null for no values", () => {
    expect(mean([null, null])).toBeNull();
  });
});

describe("assembleVolStats", () => {
  const series: VolHistoryPoint[] = [];
  // 300 ascending days: iv ramps 0.10 → 0.40, hv = iv - 0.03.
  for (let i = 0; i < 300; i++) {
    const iv = 0.1 + (0.3 * i) / 299;
    series.push({ date: `2025-${String(i)}`, iv, hv: iv - 0.03, vrp: 0.03 });
  }
  const stats = assembleVolStats(series, { high: 0.4, low: 0.1 });

  it("uses the latest point as current", () => {
    expect(stats.currentIv).toBeCloseTo(0.4, 6);
    expect(stats.currentVrp).toBeCloseTo(0.03, 6);
  });
  it("computes IV rank from the year range", () => {
    expect(stats.ivRank).toBeCloseTo(1, 6); // current = high
  });
  it("IV percentile is high since today is the max", () => {
    expect(stats.ivPercentile).toBeGreaterThan(0.9);
  });
  it("avg30 < current while IV is ramping up", () => {
    expect(stats.avg30Iv).not.toBeNull();
    expect(stats.avg30Iv!).toBeLessThan(stats.currentIv!);
  });
});

// ── Skew ────────────────────────────────────────────────
function cq(p: Partial<ContractQuote>): ContractQuote {
  return {
    bid: null, ask: null, last: null, mid: null, iv: null,
    delta: null, gamma: null, theta: null, vega: null, rho: null,
    openInterest: null, volume: null, ...p,
  };
}

describe("computeSkew", () => {
  // Strikes 80..120 by 10; spot 100. Puts skewed higher than calls (downside fear).
  const strikes: OptionStrikeQuotes[] = [
    { strike: 80, put: cq({ iv: 0.40, delta: -0.10 }), call: cq({ iv: 0.40, delta: 0.90 }) },
    { strike: 90, put: cq({ iv: 0.34, delta: -0.25 }), call: cq({ iv: 0.34, delta: 0.75 }) },
    { strike: 100, put: cq({ iv: 0.30, delta: -0.50 }), call: cq({ iv: 0.30, delta: 0.50 }) },
    { strike: 110, put: cq({ iv: 0.27, delta: -0.75 }), call: cq({ iv: 0.27, delta: 0.25 }) },
    { strike: 120, put: cq({ iv: 0.26, delta: -0.90 }), call: cq({ iv: 0.26, delta: 0.10 }) },
  ];
  const skew = computeSkew(strikes, 100, "2026-07-17");

  it("finds the ATM IV (strike nearest spot)", () => {
    expect(skew.atmIv).toBeCloseTo(0.3, 6);
  });
  it("finds 25-delta put and call IVs", () => {
    expect(skew.put25Iv).toBeCloseTo(0.34, 6); // delta -0.25 at strike 90
    expect(skew.call25Iv).toBeCloseTo(0.27, 6); // delta 0.25 at strike 110
  });
  it("risk reversal = put25 - call25 (positive = downside fear)", () => {
    expect(skew.riskReversal).toBeCloseTo(0.07, 6);
  });
  it("emits one point per strike", () => {
    expect(skew.points).toHaveLength(5);
  });
});
