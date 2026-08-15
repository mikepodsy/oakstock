import { describe, it, expect } from "vitest";
import { spreadLabels } from "./chartLabels";

/** Smallest gap between any two labels, however they were ordered. */
function minSpacing(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    min = Math.min(min, sorted[i] - sorted[i - 1]);
  }
  return min;
}

describe("spreadLabels", () => {
  it("leaves well-separated labels exactly where they were", () => {
    expect(spreadLabels([10, 50, 90], 14)).toEqual([10, 50, 90]);
  });

  it("separates labels that would overlap", () => {
    const out = spreadLabels([100, 104, 108], 14);
    expect(minSpacing(out)).toBeGreaterThanOrEqual(14);
  });

  it("preserves the caller's ordering, not the sorted order", () => {
    // Max / Avg / Current / Min arrive in label order, not top-to-bottom.
    const out = spreadLabels([200, 100, 104], 14);
    // The one that started highest must still be the largest of the three.
    expect(out[0]).toBeGreaterThan(out[1]);
    expect(out[0]).toBeGreaterThan(out[2]);
  });

  it("keeps relative order of the values it moves", () => {
    const out = spreadLabels([100, 102, 101], 10);
    expect(out[0]).toBeLessThan(out[2]);
    expect(out[2]).toBeLessThan(out[1]);
  });

  it("pulls a stack back inside the bottom bound", () => {
    const out = spreadLabels([190, 195, 199], 14, { min: 0, max: 200 });
    expect(Math.max(...out)).toBeLessThanOrEqual(200);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
    expect(minSpacing(out)).toBeGreaterThanOrEqual(14);
  });

  it("pushes a stack down off the top bound", () => {
    const out = spreadLabels([1, 3, 5], 14, { min: 0, max: 200 });
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
    expect(minSpacing(out)).toBeGreaterThanOrEqual(14);
  });

  it("clamps inside the bounds when the labels cannot all fit", () => {
    // Four labels needing 14px each will not fit in 20px of plot.
    const out = spreadLabels([5, 6, 7, 8], 14, { min: 0, max: 20 });
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it("handles a single label and an empty list", () => {
    expect(spreadLabels([42], 14)).toEqual([42]);
    expect(spreadLabels([], 14)).toEqual([]);
  });
});
