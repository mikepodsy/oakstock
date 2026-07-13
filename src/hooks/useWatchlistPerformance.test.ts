import { describe, it, expect } from "vitest";
import { averageReturns } from "./useWatchlistPerformance";

describe("averageReturns", () => {
  it("equal-weights the returns of all present tickers", () => {
    const result = averageReturns(["AAPL", "NVDA", "MSFT"], {
      AAPL: 2,
      NVDA: 5,
      MSFT: -1,
    });
    expect(result).toBeCloseTo(2);
  });

  it("averages over only the tickers that have data", () => {
    const result = averageReturns(["AAPL", "NVDA", "MSFT"], {
      AAPL: 4,
      MSFT: 2,
    });
    // NVDA has no value → excluded, average of 4 and 2.
    expect(result).toBeCloseTo(3);
  });

  it("returns null when no ticker has data", () => {
    expect(averageReturns(["AAPL", "NVDA"], {})).toBeNull();
  });

  it("returns null for an empty watchlist", () => {
    expect(averageReturns([], { AAPL: 5 })).toBeNull();
  });

  it("ignores non-finite values", () => {
    expect(averageReturns(["AAPL", "NVDA"], { AAPL: NaN, NVDA: 6 })).toBeCloseTo(6);
  });
});
