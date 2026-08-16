import { describe, it, expect } from "vitest";
import { buildFinancialData, type RawFinancialsInput } from "./financials";

/**
 * Trimmed from a live AAPL quoteSummary response on 2026-08-16.
 *
 * The shape matters as much as the values: Yahoo returns `trailingPE`,
 * `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `dividendYield` and `volume` ONLY
 * under `summaryDetail`. `defaultKeyStatistics` carries `forwardPE` and
 * `trailingEps` but none of the others — reading them from there yields
 * undefined, which is what these fixtures encode.
 */
function aaplInput(overrides: Partial<RawFinancialsInput> = {}): RawFinancialsInput {
  return {
    defaultKeyStatistics: {
      forwardPE: 32.17704,
      trailingEps: 8.72,
    },
    summaryDetail: {
      trailingPE: 35.083714,
      forwardPE: 32.17704,
      fiftyTwoWeekHigh: 344.57,
      fiftyTwoWeekLow: 223.78,
      dividendYield: 0.0034999999,
      volume: 26054077,
    },
    financialData: {
      totalRevenue: 434298000000,
      profitMargins: 0.27,
      debtToEquity: 154.486,
      revenueGrowth: 0.164,
      earningsGrowth: 0.287,
      recommendationKey: "buy",
      targetMeanPrice: 310.5,
    },
    assetProfile: {
      longBusinessSummary: "Apple Inc. designs…",
      website: "https://www.apple.com",
    },
    ...overrides,
  };
}

describe("buildFinancialData", () => {
  it("reads the valuation and 52-week fields from summaryDetail", () => {
    const data = buildFinancialData("AAPL", aaplInput());

    expect(data.peRatio).toBe(35.083714);
    expect(data.fiftyTwoWeekHigh).toBe(344.57);
    expect(data.fiftyTwoWeekLow).toBe(223.78);
    expect(data.dividendYield).toBe(0.0034999999);
    expect(data.volume).toBe(26054077);
  });

  it("does not fall back to defaultKeyStatistics for the trailing P/E", () => {
    // Regression guard: these lived under defaultKeyStatistics in the original
    // mapping, where Yahoo never populates them, so every card rendered N/A.
    const data = buildFinancialData("AAPL", {
      ...aaplInput(),
      summaryDetail: null,
    });

    expect(data.peRatio).toBeNull();
    expect(data.fiftyTwoWeekHigh).toBeNull();
    expect(data.fiftyTwoWeekLow).toBeNull();
  });

  it("prefers summaryDetail.forwardPE but falls back to defaultKeyStatistics", () => {
    expect(buildFinancialData("AAPL", aaplInput()).forwardPE).toBe(32.17704);

    // SHOP.TO returns different forward P/E values in the two modules; the
    // summaryDetail one matches what Yahoo shows on the quote page.
    const split = buildFinancialData("SHOP.TO", {
      ...aaplInput(),
      defaultKeyStatistics: { forwardPE: 88.03599, trailingEps: 2.06 },
      summaryDetail: { ...aaplInput().summaryDetail, forwardPE: 63.42649 },
    });
    expect(split.forwardPE).toBe(63.42649);

    const noDetail = buildFinancialData("AAPL", {
      ...aaplInput(),
      summaryDetail: { trailingPE: 35.08 },
    });
    expect(noDetail.forwardPE).toBe(32.17704);
  });

  it("passes revenue growth through as the year-over-year decimal", () => {
    expect(buildFinancialData("AAPL", aaplInput()).revenueGrowth).toBe(0.164);
    expect(buildFinancialData("TSLA", {
      ...aaplInput(),
      financialData: { ...aaplInput().financialData, revenueGrowth: -0.03 },
    }).revenueGrowth).toBe(-0.03);
  });

  it("preserves a zero growth rate instead of nulling it", () => {
    const flat = buildFinancialData("KO", {
      ...aaplInput(),
      financialData: { ...aaplInput().financialData, revenueGrowth: 0 },
    });
    expect(flat.revenueGrowth).toBe(0);
  });

  it("returns nulls across the board when every module is missing", () => {
    const data = buildFinancialData("XYZ", {});

    expect(data.ticker).toBe("XYZ");
    expect(data.peRatio).toBeNull();
    expect(data.forwardPE).toBeNull();
    expect(data.fiftyTwoWeekHigh).toBeNull();
    expect(data.fiftyTwoWeekLow).toBeNull();
    expect(data.revenueGrowth).toBeNull();
    expect(data.eps).toBeNull();
    expect(data.description).toBeNull();
    expect(data.website).toBeNull();
  });

  it("still maps the profile and analyst fields", () => {
    const data = buildFinancialData("AAPL", aaplInput());

    expect(data.eps).toBe(8.72);
    expect(data.revenue).toBe(434298000000);
    expect(data.debtToEquity).toBe(154.486);
    expect(data.analystRating).toBe("Buy");
    expect(data.targetPrice).toBe(310.5);
    expect(data.website).toBe("apple.com");
    expect(data.description).toBe("Apple Inc. designs…");
  });

  it("formats unmapped recommendation keys and drops bad website URLs", () => {
    const data = buildFinancialData("AAPL", {
      ...aaplInput(),
      financialData: { ...aaplInput().financialData, recommendationKey: "strong_buy" },
      assetProfile: { website: "not a url" },
    });

    expect(data.analystRating).toBe("Strong Buy");
    expect(data.website).toBeNull();
  });
});
