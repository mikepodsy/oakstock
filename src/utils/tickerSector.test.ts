import { describe, it, expect } from "vitest";
import { staticSector } from "./tickerSector";

describe("staticSector", () => {
  it("maps a large-cap stock to its GICS sector", () => {
    expect(staticSector("AAPL")).toBe("Information Technology");
    expect(staticSector("XOM")).toBe("Energy");
    expect(staticSector("JPM")).toBe("Financials");
  });

  it("maps an ETF to its RADAR category label", () => {
    expect(staticSector("SPY")).toBe("Broad Market & Index");
    expect(staticSector("XLE")).toBe("Energy");
  });

  it("normalizes separator differences (BRK-B vs BRK.B)", () => {
    // RADAR_SECTORS stores "BRK.B"; the momentum universe uses "BRK-B".
    expect(staticSector("BRK-B")).toBe(staticSector("BRK.B"));
    expect(staticSector("BRK-B")).toBe("Financials");
  });

  it("is case-insensitive", () => {
    expect(staticSector("aapl")).toBe("Information Technology");
  });

  it("returns null for tickers not in the maps", () => {
    expect(staticSector("ZZZZ_NOT_A_TICKER")).toBeNull();
  });
});
