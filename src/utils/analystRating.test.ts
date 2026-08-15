import { describe, it, expect } from "vitest";
import type { AnalystDistribution } from "@/types";
import {
  consensusScore,
  distributionRows,
  distributionScore,
  distributionTotal,
  targetUpside,
} from "./analystRating";

function dist(
  partial: Partial<AnalystDistribution> = {}
): AnalystDistribution {
  return { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0, ...partial };
}

describe("consensusScore", () => {
  // Yahoo's recommendationMean runs 1 (strong buy) … 5 (strong sell); the gauge
  // wants −1 … 1 the other way round.
  it("maps Yahoo's 1–5 mean onto the gauge's −1…1 score", () => {
    expect(consensusScore(1)).toBe(1);
    expect(consensusScore(2)).toBe(0.5);
    expect(consensusScore(3)).toBe(0);
    expect(consensusScore(4)).toBe(-0.5);
    expect(consensusScore(5)).toBe(-1);
  });

  it("matches the live GOOG reading that produced a Strong buy verdict", () => {
    // recommendationMean 1.39683 → 0.80, comfortably inside the strongBuy band.
    expect(consensusScore(1.39683)).toBeCloseTo(0.8016, 4);
  });

  it("clamps means outside 1–5 rather than producing an off-gauge score", () => {
    expect(consensusScore(0.5)).toBe(1);
    expect(consensusScore(6)).toBe(-1);
  });

  it("returns null when there is no consensus", () => {
    expect(consensusScore(null)).toBeNull();
  });
});

describe("distributionScore", () => {
  // The fallback when Yahoo has a recommendation breakdown but no mean.
  it("scores a unanimous strong buy at 1 and a unanimous strong sell at −1", () => {
    expect(distributionScore(dist({ strongBuy: 10 }))).toBe(1);
    expect(distributionScore(dist({ strongSell: 10 }))).toBe(-1);
  });

  it("scores an all-hold book at 0", () => {
    expect(distributionScore(dist({ hold: 7 }))).toBe(0);
  });

  it("weights buy at half of strong buy", () => {
    // 2 strong buy (+1 each) + 2 buy (+0.5 each) = 3 / 4 analysts = 0.75
    expect(distributionScore(dist({ strongBuy: 2, buy: 2 }))).toBe(0.75);
  });

  it("cancels symmetric books to neutral", () => {
    expect(distributionScore(dist({ strongBuy: 3, strongSell: 3 }))).toBe(0);
    expect(distributionScore(dist({ buy: 4, sell: 4 }))).toBe(0);
  });

  it("returns null when nobody covers the name, rather than a false neutral", () => {
    expect(distributionScore(dist())).toBeNull();
    expect(distributionScore(null)).toBeNull();
  });
});

describe("distributionTotal", () => {
  it("sums every bucket", () => {
    expect(distributionTotal(dist({ strongBuy: 13, buy: 44, hold: 6 }))).toBe(63);
  });

  it("is 0 for no coverage", () => {
    expect(distributionTotal(null)).toBe(0);
  });
});

describe("distributionRows", () => {
  const rows = distributionRows(dist({ strongBuy: 13, buy: 44, hold: 6 }));

  it("lists the buckets strongest-buy first, as the gauge reads left to right", () => {
    expect(rows.map((r) => r.label)).toEqual([
      "Strong buy",
      "Buy",
      "Hold",
      "Sell",
      "Strong sell",
    ]);
  });

  it("scales each bar against the largest bucket, not the total", () => {
    // Otherwise the biggest bar never fills its track and the chart reads flat.
    expect(rows[1].fraction).toBe(1); // buy: 44, the max
    expect(rows[0].fraction).toBeCloseTo(13 / 44, 6);
    expect(rows[3].fraction).toBe(0);
  });

  it("keeps the raw counts alongside", () => {
    expect(rows.map((r) => r.count)).toEqual([13, 44, 6, 0, 0]);
  });

  it("exposes the bucket key, so firm-level rows can be matched to a bar", () => {
    expect(rows.map((r) => r.key)).toEqual([
      "strongBuy",
      "buy",
      "hold",
      "sell",
      "strongSell",
    ]);
  });

  it("returns an empty list for no coverage", () => {
    expect(distributionRows(null)).toEqual([]);
  });
});

describe("targetUpside", () => {
  it("reports the absolute and percentage gap to the mean target", () => {
    // GOOG: 343.54 spot, 421.79 mean target.
    const up = targetUpside(421.78857, 343.54);
    expect(up).not.toBeNull();
    expect(up!.absolute).toBeCloseTo(78.2486, 4);
    expect(up!.percent).toBeCloseTo(0.22777, 5);
  });

  it("goes negative when the target sits below spot", () => {
    const down = targetUpside(90, 100);
    expect(down!.absolute).toBe(-10);
    expect(down!.percent).toBeCloseTo(-0.1, 10);
  });

  it("returns null when either side is missing or price is zero", () => {
    expect(targetUpside(null, 100)).toBeNull();
    expect(targetUpside(100, null)).toBeNull();
    expect(targetUpside(100, 0)).toBeNull();
  });
});
