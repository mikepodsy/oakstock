import { describe, expect, it } from "vitest";
import { computeRatioCandles, type OhlcBar } from "./ratioCandles";

const rsp: OhlcBar[] = [
  { date: "2026-01-02", open: 180, high: 184, low: 179, close: 182 },
  { date: "2026-01-03", open: 182, high: 186, low: 181, close: 185 },
];
const spy: OhlcBar[] = [
  { date: "2026-01-02", open: 600, high: 610, low: 595, close: 605 },
  { date: "2026-01-03", open: 605, high: 612, low: 602, close: 610 },
];

describe("computeRatioCandles", () => {
  it("uses true bounds: high = a.high/b.low, low = a.low/b.high", () => {
    const [first] = computeRatioCandles(rsp, spy);
    expect(first.time).toBe("2026-01-02");
    expect(first.open).toBeCloseTo(180 / 600, 4);
    expect(first.close).toBeCloseTo(182 / 605, 4);
    expect(first.high).toBeCloseTo(184 / 595, 4); // a.high / b.low
    expect(first.low).toBeCloseTo(179 / 610, 4); // a.low / b.high
    // The true-bounds high/low must envelope open and close.
    expect(first.high).toBeGreaterThanOrEqual(Math.max(first.open, first.close));
    expect(first.low).toBeLessThanOrEqual(Math.min(first.open, first.close));
  });

  it("rounds to the requested decimals", () => {
    const [first] = computeRatioCandles(rsp, spy, 4);
    expect(first.open).toBe(parseFloat((180 / 600).toFixed(4)));
  });

  it("skips dates missing from either series", () => {
    const result = computeRatioCandles(rsp, [spy[0]]);
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe("2026-01-02");
  });

  it("skips bars with a non-positive or non-finite denominator", () => {
    const badSpy: OhlcBar[] = [
      { date: "2026-01-02", open: 0, high: 610, low: 595, close: 605 },
      { date: "2026-01-03", open: 605, high: 612, low: 602, close: NaN },
    ];
    expect(computeRatioCandles(rsp, badSpy)).toHaveLength(0);
  });
});
