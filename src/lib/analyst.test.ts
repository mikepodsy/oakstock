import { describe, it, expect } from "vitest";
import { buildAnalystData, quarterLabel, type RawAnalystInput } from "./analyst";

/** Trimmed from a live GOOG response on 2026-08-14. */
function googInput(overrides: Partial<RawAnalystInput> = {}): RawAnalystInput {
  return {
    financialData: {
      currentPrice: 343.54,
      targetHighPrice: 475,
      targetLowPrice: 340,
      targetMeanPrice: 421.78857,
      targetMedianPrice: 425,
      recommendationMean: 1.39683,
      numberOfAnalystOpinions: 14,
      financialCurrency: "USD",
    },
    recommendationTrend: {
      trend: [
        { period: "0m", strongBuy: 13, buy: 44, hold: 6, sell: 0, strongSell: 0 },
        { period: "-1m", strongBuy: 1, buy: 2, hold: 3, sell: 4, strongSell: 5 },
      ],
    },
    earnings: {
      earningsChart: {
        quarterly: [
          { date: "3Q2025", actual: 2.87, estimate: 2.26206 },
          { date: "4Q2025", actual: 2.82, estimate: 2.64089 },
          { date: "1Q2026", actual: 5.11, estimate: 2.62989 },
          { date: "2Q2026", actual: 9.11, estimate: 2.91149 },
        ],
      },
    },
    earningsTrend: {
      trend: [
        {
          period: "0q",
          endDate: "2026-09-30T00:00:00.000Z",
          earningsEstimate: { avg: 2.99803 },
        },
        {
          period: "+1q",
          endDate: "2026-12-31T00:00:00.000Z",
          earningsEstimate: { avg: 3.32977 },
        },
        {
          period: "0y",
          endDate: "2026-12-31T00:00:00.000Z",
          earningsEstimate: { avg: 20.57985 },
        },
        {
          period: "+1y",
          endDate: "2027-12-31T00:00:00.000Z",
          earningsEstimate: { avg: 24.1 },
        },
        {
          period: "+5y",
          endDate: null,
          earningsEstimate: { avg: 30 },
        },
      ],
    },
    annualEps: [
      { year: 2022, eps: 4.56 },
      { year: 2023, eps: 5.8 },
      { year: 2024, eps: 8.04 },
      { year: 2025, eps: 10.81 },
    ],
    ...overrides,
  };
}

describe("quarterLabel", () => {
  it("names the calendar quarter the period ends in", () => {
    expect(quarterLabel(new Date("2026-09-30T00:00:00.000Z"))).toBe("3Q2026");
    expect(quarterLabel(new Date("2026-12-31T00:00:00.000Z"))).toBe("4Q2026");
    expect(quarterLabel(new Date("2027-01-31T00:00:00.000Z"))).toBe("1Q2027");
  });
});

describe("buildAnalystData", () => {
  it("carries the price target across, including the median", () => {
    const d = buildAnalystData("GOOG", googInput());
    expect(d.target).toEqual({
      mean: 421.78857,
      median: 425,
      high: 475,
      low: 340,
      analystCount: 14,
    });
    expect(d.currentPrice).toBe(343.54);
    expect(d.currency).toBe("USD");
  });

  it("takes the current month's recommendation snapshot, not an older one", () => {
    const d = buildAnalystData("GOOG", googInput());
    expect(d.distribution).toEqual({
      strongBuy: 13,
      buy: 44,
      hold: 6,
      sell: 0,
      strongSell: 0,
    });
  });

  it("falls back to the first trend entry when there is no 0m period", () => {
    const d = buildAnalystData("GOOG", {
      ...googInput(),
      recommendationTrend: {
        trend: [
          { period: "-1m", strongBuy: 2, buy: 1, hold: 0, sell: 0, strongSell: 0 },
        ],
      },
    });
    expect(d.distribution?.strongBuy).toBe(2);
  });

  describe("annual EPS", () => {
    it("puts reported years first, then the two forecast years, in order", () => {
      const { annual } = buildAnalystData("GOOG", googInput()).eps;
      expect(annual.map((p) => p.label)).toEqual([
        "2022",
        "2023",
        "2024",
        "2025",
        "2026",
        "2027",
      ]);
    });

    it("marks reported years with an actual and forecast years with an estimate", () => {
      const { annual } = buildAnalystData("GOOG", googInput()).eps;
      expect(annual[3]).toEqual({ label: "2025", actual: 10.81, estimate: null });
      expect(annual[4]).toEqual({ label: "2026", actual: null, estimate: 20.57985 });
      expect(annual[5]).toEqual({ label: "2027", actual: null, estimate: 24.1 });
    });

    it("ignores +5y, which has no end date to place it on the axis", () => {
      const { annual } = buildAnalystData("GOOG", googInput()).eps;
      expect(annual.some((p) => p.estimate === 30)).toBe(false);
    });

    it("merges an estimate into a year that has already reported", () => {
      // A fiscal year can be fully reported while 0y still carries a consensus.
      const { annual } = buildAnalystData("GOOG", {
        ...googInput(),
        annualEps: [{ year: 2026, eps: 19.5 }],
      }).eps;
      const y2026 = annual.filter((p) => p.label === "2026");
      expect(y2026).toHaveLength(1);
      expect(y2026[0]).toEqual({
        label: "2026",
        actual: 19.5,
        estimate: 20.57985,
      });
    });

    it("skips years with no diluted EPS on file", () => {
      const { annual } = buildAnalystData("GOOG", {
        ...googInput(),
        annualEps: [
          { year: 2021, eps: null },
          { year: 2022, eps: 4.56 },
        ],
      }).eps;
      expect(annual.map((p) => p.label)).not.toContain("2021");
    });
  });

  describe("quarterly EPS", () => {
    it("keeps reported quarters with both the actual and what was expected", () => {
      const { quarterly } = buildAnalystData("GOOG", googInput()).eps;
      expect(quarterly[0]).toEqual({
        label: "3Q2025",
        actual: 2.87,
        estimate: 2.26206,
      });
    });

    it("appends the current and next quarter as estimate-only bars", () => {
      const { quarterly } = buildAnalystData("GOOG", googInput()).eps;
      expect(quarterly.map((p) => p.label)).toEqual([
        "3Q2025",
        "4Q2025",
        "1Q2026",
        "2Q2026",
        "3Q2026",
        "4Q2026",
      ]);
      expect(quarterly[4]).toEqual({
        label: "3Q2026",
        actual: null,
        estimate: 2.99803,
      });
    });

    it("does not duplicate a quarter that has already reported", () => {
      // 0q can still point at a quarter whose actual has just landed.
      const { quarterly } = buildAnalystData("GOOG", {
        ...googInput(),
        earnings: {
          earningsChart: {
            quarterly: [{ date: "3Q2026", actual: 3.1, estimate: 2.99 }],
          },
        },
      }).eps;
      expect(quarterly.filter((p) => p.label === "3Q2026")).toHaveLength(1);
      expect(quarterly[0].actual).toBe(3.1);
    });

    it("sorts reported quarters chronologically across a year boundary", () => {
      const { quarterly } = buildAnalystData("GOOG", {
        ...googInput(),
        earnings: {
          earningsChart: {
            quarterly: [
              { date: "1Q2026", actual: 5.11, estimate: 2.62 },
              { date: "4Q2025", actual: 2.82, estimate: 2.64 },
            ],
          },
        },
      }).eps;
      expect(quarterly.slice(0, 2).map((p) => p.label)).toEqual([
        "4Q2025",
        "1Q2026",
      ]);
    });
  });

  describe("thin or missing coverage", () => {
    it("returns nulls rather than throwing when Yahoo has nothing", () => {
      const d = buildAnalystData("SPY", {});
      expect(d.ticker).toBe("SPY");
      expect(d.target).toBeNull();
      expect(d.distribution).toBeNull();
      expect(d.consensusMean).toBeNull();
      expect(d.currentPrice).toBeNull();
      expect(d.eps.annual).toEqual([]);
      expect(d.eps.quarterly).toEqual([]);
    });

    it("drops a price target with no high/low range to plot", () => {
      const d = buildAnalystData("X", {
        financialData: { currentPrice: 10, targetMeanPrice: 12 },
      });
      expect(d.target).toBeNull();
    });

    it("treats an all-zero recommendation trend as no coverage", () => {
      const d = buildAnalystData("X", {
        recommendationTrend: {
          trend: [
            { period: "0m", strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 },
          ],
        },
      });
      expect(d.distribution).toBeNull();
    });
  });
});
