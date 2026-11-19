import { describe, expect, it } from "vitest";
import { mean, median, ols, percentileRank, premium } from "./stats";

describe("median / mean", () => {
  it("ignores nulls and non-finite values", () => {
    expect(median([3, null, 1, NaN, 2])).toBe(2);
    expect(mean([2, null, 4])).toBe(3);
  });
  it("averages the two middle values for even counts", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("is null when nothing is left", () => {
    expect(median([null, undefined])).toBeNull();
    expect(mean([])).toBeNull();
  });
});

describe("percentileRank", () => {
  it("ranks a member of the set against the others", () => {
    const set = [10, 20, 30, 40, 50];
    expect(percentileRank(10, set)).toBe(0);
    expect(percentileRank(50, set)).toBe(1);
    expect(percentileRank(30, set)).toBe(0.5);
  });
  it("counts ties as half", () => {
    expect(percentileRank(5, [5, 5, 5])).toBe(0.5);
  });
  it("is null for NM values or a set too small to rank", () => {
    expect(percentileRank(null, [1, 2, 3])).toBeNull();
    expect(percentileRank(1, [1])).toBeNull();
  });
});

describe("premium", () => {
  it("is the signed fraction over the benchmark", () => {
    expect(premium(25, 20)).toBeCloseTo(0.25);
    expect(premium(15, 20)).toBeCloseTo(-0.25);
    expect(premium(null, 20)).toBeNull();
  });
});

describe("ols", () => {
  it("recovers an exact line with r² = 1", () => {
    const r = ols([1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 })))!;
    expect(r.slope).toBeCloseTo(2);
    expect(r.intercept).toBeCloseTo(1);
    expect(r.r2).toBeCloseTo(1);
    expect(r.n).toBe(4);
  });
  it("gives a partial r² for noisy data", () => {
    const r = ols([
      { x: 1, y: 1 },
      { x: 2, y: 3 },
      { x: 3, y: 2 },
      { x: 4, y: 5 },
    ])!;
    expect(r.slope).toBeCloseTo(1.1);
    expect(r.r2).toBeGreaterThan(0);
    expect(r.r2).toBeLessThan(1);
  });
  it("needs three points and some x variance", () => {
    expect(ols([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
    expect(ols([1, 2, 3].map((y) => ({ x: 5, y })))).toBeNull();
  });
});
