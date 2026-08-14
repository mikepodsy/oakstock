import { describe, it, expect } from "vitest";
import {
  computeTechnicalRating,
  ratingFromScore,
  type RatingGroup,
} from "./technicalRating";
import type { QuestradeCandle } from "@/types";

function bar(i: number, o: number, h: number, l: number, c: number): QuestradeCandle {
  return {
    time: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    open: o,
    high: h,
    low: l,
    close: c,
    volume: 1000,
  };
}

/** `n` bars advancing one point per bar, with a one-point range around each close. */
function uptrend(n: number, start = 100): QuestradeCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const c = start + i;
    return bar(i, c - 0.5, c + 0.5, c - 1, c);
  });
}

function downtrend(n: number, start = 500): QuestradeCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const c = start - i;
    return bar(i, c + 0.5, c + 1, c - 0.5, c);
  });
}

/** Every reading that could actually be computed. */
function voted(group: RatingGroup) {
  return group.readings.filter((r) => r.vote !== null);
}

describe("ratingFromScore", () => {
  it("maps the five TradingView bands", () => {
    expect(ratingFromScore(-1)).toBe("strongSell");
    expect(ratingFromScore(-0.7)).toBe("strongSell");
    expect(ratingFromScore(-0.3)).toBe("sell");
    expect(ratingFromScore(0)).toBe("neutral");
    expect(ratingFromScore(0.3)).toBe("buy");
    expect(ratingFromScore(0.7)).toBe("strongBuy");
    expect(ratingFromScore(1)).toBe("strongBuy");
  });

  it("puts the band edges on TradingView's side of the line", () => {
    // Strong sell is score < -0.5, so -0.5 itself is still Sell; Neutral owns
    // both -0.1 and 0.1; Buy owns 0.5.
    expect(ratingFromScore(-0.5)).toBe("sell");
    expect(ratingFromScore(-0.50001)).toBe("strongSell");
    expect(ratingFromScore(-0.1)).toBe("neutral");
    expect(ratingFromScore(0.1)).toBe("neutral");
    expect(ratingFromScore(0.5)).toBe("buy");
    expect(ratingFromScore(0.50001)).toBe("strongBuy");
  });
});

describe("computeTechnicalRating", () => {
  it("returns null when there aren't enough candles to compute anything", () => {
    expect(computeTechnicalRating([])).toBeNull();
    expect(computeTechnicalRating(uptrend(3))).toBeNull();
  });

  // Two of the fifteen sit out on a synthetic constant-slope series: Ichimoku
  // only votes on a crossover, and the Hull average has zero lag on a straight
  // line so it lands exactly on the close. The other thirteen are unanimous.
  it("rates a sustained advance as a buy on the moving averages", () => {
    const r = computeTechnicalRating(uptrend(260))!;
    expect(r.movingAverages.counts.buy).toBe(13);
    expect(r.movingAverages.counts.sell).toBe(0);
    expect(r.movingAverages.rating).toBe("strongBuy");
  });

  it("rates a sustained decline as a sell on the moving averages", () => {
    const r = computeTechnicalRating(downtrend(260))!;
    expect(r.movingAverages.counts.sell).toBe(13);
    expect(r.movingAverages.counts.buy).toBe(0);
    expect(r.movingAverages.rating).toBe("strongSell");
  });

  it("averages the two group scores rather than all 26 votes", () => {
    // The groups have different sizes (11 vs 15), so pooling every vote would
    // give a different number than averaging the two group scores.
    const r = computeTechnicalRating(uptrend(260))!;
    expect(r.summary.score).toBeCloseTo(
      (r.oscillators.score + r.movingAverages.score) / 2,
      10
    );
  });

  it("counts each computable indicator exactly once", () => {
    const r = computeTechnicalRating(uptrend(260))!;
    for (const group of [r.oscillators, r.movingAverages]) {
      const { buy, sell, neutral } = group.counts;
      expect(buy + sell + neutral).toBe(voted(group).length);
    }
    expect(r.summary.counts.buy).toBe(
      r.oscillators.counts.buy + r.movingAverages.counts.buy
    );
    expect(r.summary.counts.sell).toBe(
      r.oscillators.counts.sell + r.movingAverages.counts.sell
    );
  });

  it("always reports all 26 indicators, computable or not", () => {
    const r = computeTechnicalRating(uptrend(60))!;
    expect(r.oscillators.readings).toHaveLength(11);
    expect(r.movingAverages.readings).toHaveLength(15);
  });

  it("excludes indicators without enough data instead of voting them neutral", () => {
    // 60 bars can't produce a 200-period average, so those rows carry no value
    // and no vote, and must not drag the score toward neutral.
    const short = computeTechnicalRating(uptrend(60))!;
    const missing = short.movingAverages.readings.filter((x) => x.vote === null);
    expect(missing.length).toBeGreaterThan(0);
    for (const m of missing) expect(m.value).toBeNull();

    const { buy, sell, neutral } = short.movingAverages.counts;
    expect(buy + sell + neutral).toBe(15 - missing.length);
    // Still a clean advance, so what *can* be computed is unanimous.
    expect(short.movingAverages.rating).toBe("strongBuy");
  });

  it("scores a group as (buys - sells) over its computable indicators", () => {
    const r = computeTechnicalRating(uptrend(260))!;
    const g = r.movingAverages;
    expect(g.score).toBeCloseTo(
      (g.counts.buy - g.counts.sell) / voted(g).length,
      10
    );
  });
});
