import { describe, it, expect } from "vitest";
import { distanceToSegment, midpoint } from "./geometry";

describe("distanceToSegment", () => {
  it("returns 0 when the point lies on the segment", () => {
    expect(
      distanceToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })
    ).toBe(0);
  });

  it("measures perpendicular distance to a horizontal segment", () => {
    expect(
      distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })
    ).toBeCloseTo(3);
  });

  it("clamps to the nearest endpoint when the projection falls outside", () => {
    // Point is to the left of point a → distance is to a, not the infinite line.
    expect(
      distanceToSegment({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })
    ).toBeCloseTo(4);
  });

  it("handles a degenerate (zero-length) segment as distance to that point", () => {
    expect(
      distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })
    ).toBeCloseTo(5);
  });

  it("measures distance to a diagonal segment", () => {
    // Segment from (0,0)→(10,10); point (10,0) is sqrt(50) from the line y=x.
    expect(
      distanceToSegment({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 10 })
    ).toBeCloseTo(Math.sqrt(50));
  });
});

describe("midpoint", () => {
  it("returns the average of the two points", () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 4 })).toEqual({ x: 5, y: 2 });
  });
});
