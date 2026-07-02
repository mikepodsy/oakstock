import { describe, it, expect } from "vitest";
import { ETF_UNIVERSE, RADAR_ETF_CATEGORIES } from "./constants";

describe("ETF_UNIVERSE", () => {
  it("is non-empty", () => {
    expect(ETF_UNIVERSE.length).toBeGreaterThan(100);
  });

  it("has no duplicates", () => {
    expect(new Set(ETF_UNIVERSE).size).toBe(ETF_UNIVERSE.length);
  });

  it("excludes the leveraged_inverse category's exclusive tickers", () => {
    // TQQQ/SQQQ live only in leveraged_inverse, so they must be absent.
    expect(ETF_UNIVERSE).not.toContain("TQQQ");
    expect(ETF_UNIVERSE).not.toContain("SQQQ");
  });

  it("includes broad-market staples", () => {
    for (const t of ["SPY", "QQQ", "IWM", "TLT", "GLD"]) {
      expect(ETF_UNIVERSE).toContain(t);
    }
  });

  it("covers every non-leveraged category ticker", () => {
    const expected = new Set(
      Object.entries(RADAR_ETF_CATEGORIES)
        .filter(([key]) => key !== "leveraged_inverse")
        .flatMap(([, cat]) => cat.tickers)
    );
    expect(new Set(ETF_UNIVERSE)).toEqual(expected);
  });
});
