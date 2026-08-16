import { describe, it, expect } from "vitest";
import { findHoveredStrike, placeStrikeTooltip } from "./strikeHover";

const bars = [
  { y: 10, strike: 100 },
  { y: 30, strike: 105 },
  { y: 50, strike: 110 },
];

describe("findHoveredStrike", () => {
  it("returns the bar the pointer sits closest to", () => {
    expect(findHoveredStrike(bars, 28, 8)?.strike).toBe(105);
  });

  it("returns null when nothing is within tolerance", () => {
    expect(findHoveredStrike(bars, 20, 5)).toBeNull();
  });

  it("picks the nearer bar when two are in range", () => {
    expect(findHoveredStrike(bars, 22, 15)?.strike).toBe(105);
  });

  it("handles an empty panel", () => {
    expect(findHoveredStrike([], 20, 10)).toBeNull();
  });
});

describe("placeStrikeTooltip", () => {
  const box = { panelW: 240, panelH: 400, tipW: 140, tipH: 60 };

  it("sits to the right of the pointer with room to spare", () => {
    const { left } = placeStrikeTooltip({ x: 20, y: 200, ...box });
    expect(left).toBe(32);
  });

  it("flips to the left when the box would overflow the panel", () => {
    const { left } = placeStrikeTooltip({ x: 200, y: 200, ...box });
    expect(left).toBe(48);
  });

  it("centers vertically on the pointer", () => {
    expect(placeStrikeTooltip({ x: 20, y: 200, ...box }).top).toBe(170);
  });

  it("clamps to the panel near the top and bottom edges", () => {
    expect(placeStrikeTooltip({ x: 20, y: 4, ...box }).top).toBe(2);
    expect(placeStrikeTooltip({ x: 20, y: 398, ...box }).top).toBe(338);
  });

  it("keeps the box on screen when the panel is narrower than the box", () => {
    const { left } = placeStrikeTooltip({ ...box, panelW: 100, x: 50, y: 50 });
    expect(left).toBe(2);
  });
});
