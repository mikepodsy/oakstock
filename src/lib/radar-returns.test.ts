import { describe, it, expect } from "vitest";
import { periodReturnFromBars } from "./radar-returns";

const bar = (date: string, close: number | null) => ({ date: new Date(date), close });
const split = (date: string, numerator: number, denominator: number) => ({
  date: new Date(date),
  numerator,
  denominator,
});

describe("periodReturnFromBars", () => {
  it("returns the percentage move from the first close to the last", () => {
    const bars = [bar("2026-08-01", 100), bar("2026-08-05", 110)];
    expect(periodReturnFromBars(bars, [])).toBeCloseTo(10, 6);
  });

  it("reports a decline as a negative percentage", () => {
    const bars = [bar("2026-08-01", 50), bar("2026-08-05", 40)];
    expect(periodReturnFromBars(bars, [])).toBeCloseTo(-20, 6);
  });

  it("ignores bars with no close", () => {
    const bars = [bar("2026-08-01", null), bar("2026-08-02", 100), bar("2026-08-05", 120)];
    expect(periodReturnFromBars(bars, [])).toBeCloseTo(20, 6);
  });

  it("needs at least two closes", () => {
    expect(periodReturnFromBars([bar("2026-08-01", 100)], [])).toBeNull();
    expect(periodReturnFromBars([], [])).toBeNull();
  });

  it("returns null when the opening close is zero", () => {
    const bars = [bar("2026-08-01", 0), bar("2026-08-05", 10)];
    expect(periodReturnFromBars(bars, [])).toBeNull();
  });

  // Yahoo's chart returns raw closes, so a reverse split looks like a huge gain:
  // PRPL went 1:25 on 2026-07-20 and showed as +2100% instead of about -12%.
  it("rescales pre-split closes across a reverse split instead of reporting a fake spike", () => {
    const bars = [
      bar("2026-07-16", 0.31),
      bar("2026-07-17", 0.29),
      bar("2026-07-21", 6.5),
      bar("2026-08-14", 6.82),
    ];
    const result = periodReturnFromBars(bars, [split("2026-07-20", 1, 25)]);
    // 0.31 pre-split is 7.75 in post-split terms → 6.82/7.75 - 1 = -12.0%
    expect(result).toBeCloseTo(-12.0, 1);
  });

  it("rescales pre-split closes across a forward split", () => {
    // 4:1 split: 400 before is 100 after, so ending at 110 is a 10% gain.
    const bars = [bar("2026-08-01", 400), bar("2026-08-20", 110)];
    const result = periodReturnFromBars(bars, [split("2026-08-10", 4, 1)]);
    expect(result).toBeCloseTo(10, 6);
  });

  it("compounds multiple splits inside the window", () => {
    // 2:1 then 3:1 → the opening 600 is worth 100 in final terms.
    const bars = [bar("2026-08-01", 600), bar("2026-08-25", 120)];
    const result = periodReturnFromBars(bars, [
      split("2026-08-05", 2, 1),
      split("2026-08-15", 3, 1),
    ]);
    expect(result).toBeCloseTo(20, 6);
  });

  it("leaves the return alone when the split predates every bar", () => {
    const bars = [bar("2026-08-01", 100), bar("2026-08-20", 130)];
    const result = periodReturnFromBars(bars, [split("2026-07-01", 1, 10)]);
    expect(result).toBeCloseTo(30, 6);
  });

  it("ignores a split dated after the last bar", () => {
    const bars = [bar("2026-08-01", 100), bar("2026-08-20", 130)];
    const result = periodReturnFromBars(bars, [split("2026-09-01", 1, 10)]);
    expect(result).toBeCloseTo(30, 6);
  });

  it("ignores malformed split ratios rather than producing Infinity", () => {
    const bars = [bar("2026-08-01", 100), bar("2026-08-20", 130)];
    const result = periodReturnFromBars(bars, [split("2026-08-10", 0, 0)]);
    expect(result).toBeCloseTo(30, 6);
  });
});
