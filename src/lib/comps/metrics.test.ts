import { describe, expect, it } from "vitest";
import type { FinancialStatement, FundamentalsData } from "@/types";
import { buildCompRow, cagr, growth, multiple, ntmEps, priceReturns, ttm, type CompSummaryInput } from "./metrics";

function stmt(date: string, o: Partial<FinancialStatement>): FinancialStatement {
  return {
    date: `${date}T00:00:00.000Z`,
    revenue: null, ebitda: null, freeCashFlow: null, operatingCashFlow: null, capex: null,
    netIncome: null, grossProfit: null, operatingIncome: null, costOfRevenue: null, eps: null,
    epsBasic: null, buybacks: null, dividendsPaid: null, totalDebt: null, stockholdersEquity: null,
    ...o,
  };
}

const QUARTER_ENDS = [
  "2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31",
  "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31",
];

// Prior four quarters: revenue 100, eps 1; latest four: revenue 125, eps 1.5.
const quarterly = QUARTER_ENDS.map((d, i) =>
  stmt(d, {
    revenue: i < 4 ? 100 : 125,
    ebitda: i < 4 ? 30 : 40,
    operatingIncome: i < 4 ? 25 : 30,
    netIncome: i < 4 ? 20 : 25,
    grossProfit: i < 4 ? 60 : 75,
    freeCashFlow: i < 4 ? 15 : 20,
    eps: i < 4 ? 1 : 1.5,
    stockholdersEquity: 400,
    totalDebt: 200,
  })
);

const annual = [
  stmt("2022-12-31", { revenue: 256, eps: 2 }),
  stmt("2023-12-31", { revenue: 320, eps: 3 }),
  stmt("2024-12-31", { revenue: 400, eps: 4 }),
  stmt("2025-12-31", { revenue: 500, eps: 6 }),
];

const fundamentals: FundamentalsData = { ticker: "TEST", quarterly, annual };

const summary: CompSummaryInput = {
  price: { regularMarketPrice: 60, marketCap: 6000, longName: "Test Corp", currency: "USD" },
  assetProfile: { sector: "Technology", industry: "Software" },
  defaultKeyStatistics: { enterpriseValue: 6100, priceToBook: 12 },
  financialData: { totalCash: 100, totalDebt: 200, debtToEquity: 50, currentRatio: 1.5, returnOnAssets: 0.1 },
  summaryDetail: { forwardPE: 30, dividendYield: 0.01 },
};

describe("helpers", () => {
  it("multiple is NM for a non-positive denominator", () => {
    expect(multiple(10, 2)).toBe(5);
    expect(multiple(10, 0)).toBeNull();
    expect(multiple(10, -5)).toBeNull();
    expect(multiple(null, 5)).toBeNull();
  });
  it("growth is null off a non-positive base", () => {
    expect(growth(120, 100)).toBeCloseTo(0.2);
    expect(growth(10, -5)).toBeNull();
  });
  it("cagr compounds", () => {
    expect(cagr(500, 256, 3)).toBeCloseTo(0.25, 5);
    expect(cagr(-1, 100, 3)).toBeNull();
  });
  it("ttm sums four consecutive quarters and rejects gaps", () => {
    expect(ttm(quarterly, "revenue")).toBe(500);
    expect(ttm(quarterly, "revenue", 4)).toBe(400);
    const gappy = [quarterly[0], quarterly[1], quarterly[5], quarterly[7]];
    expect(ttm(gappy, "revenue")).toBeNull();
  });
});

describe("buildCompRow", () => {
  const row = buildCompRow("TEST", summary, fundamentals, []);
  const v = row.values;

  it("carries identity fields", () => {
    expect(row.name).toBe("Test Corp");
    expect(row.industry).toBe("Software");
    expect(row.price).toBe(60);
  });

  it("computes valuation multiples off TTM fundamentals", () => {
    expect(v.pe).toBeCloseTo(10); // 60 / 6
    expect(v.forwardPe).toBe(30);
    expect(v.ps).toBeCloseTo(12); // 6000 / 500
    expect(v.evSales).toBeCloseTo(12.2);
    expect(v.evEbitda).toBeCloseTo(6100 / 160);
    expect(v.evEbit).toBeCloseTo(6100 / 120);
    expect(v.evFcf).toBeCloseTo(6100 / 80);
    expect(v.pFcf).toBeCloseTo(75);
    expect(v.fcfYield).toBeCloseTo(80 / 6000);
  });

  it("computes growth and a PEG", () => {
    expect(v.revenueGrowth).toBeCloseTo(0.25);
    expect(v.epsGrowth).toBeCloseTo(0.5);
    expect(v.peg).toBeCloseTo(10 / 50);
    expect(v.revenueCagr3y).toBeCloseTo(0.25, 5);
  });

  it("computes margins, returns on capital and leverage", () => {
    expect(v.grossMargin).toBeCloseTo(0.6);
    expect(v.operatingMargin).toBeCloseTo(0.24);
    expect(v.netMargin).toBeCloseTo(0.2);
    expect(v.roe).toBeCloseTo(0.25);
    expect(v.roic).toBeCloseTo((120 * 0.79) / 500);
    expect(v.debtEquity).toBeCloseTo(0.5); // Yahoo's 50 is a percent
    expect(v.netDebtEbitda).toBeCloseTo(100 / 160);
  });

  it("marks multiples NM when earnings are negative", () => {
    const losing: FundamentalsData = {
      ...fundamentals,
      quarterly: quarterly.map((q) => ({ ...q, eps: -0.5, ebitda: -10 })),
    };
    const r = buildCompRow("LOSS", summary, losing, []);
    expect(r.values.pe).toBeNull();
    expect(r.values.evEbitda).toBeNull();
    expect(r.values.peg).toBeNull();
  });

  it("falls back to Yahoo fields without fundamentals", () => {
    const r = buildCompRow(
      "YH",
      { ...summary, financialData: { ...summary.financialData, totalRevenue: 1000, grossMargins: 0.4 }, defaultKeyStatistics: { ...summary.defaultKeyStatistics, trailingEps: 3 } },
      null,
      []
    );
    expect(r.values.pe).toBeCloseTo(20);
    expect(r.values.ps).toBeCloseTo(6);
    expect(r.values.grossMargin).toBe(0.4);
    expect(r.values.evFcf).toBeNull(); // never use Yahoo's levered FCF
  });
});

describe("priceReturns", () => {
  it("measures 1M, YTD and 1Y off the closest earlier close", () => {
    const prices = [
      { date: "2025-03-10", close: 50 },
      { date: "2025-12-31", close: 80 },
      { date: "2026-02-05", close: 90 },
      { date: "2026-03-10", close: 100 },
    ];
    const r = priceReturns(prices);
    expect(r.return1m).toBeCloseTo(100 / 90 - 1);
    expect(r.returnYtd).toBeCloseTo(0.25);
    expect(r.return1y).toBeCloseTo(1);
  });
  it("is null without history", () => {
    expect(priceReturns([]).return1y).toBeNull();
  });
});

describe("cross-currency listings (ADRs, foreign filers)", () => {
  // Reports in EUR; trades in USD; one ADR ≠ one ordinary share, and Yahoo's
  // enterpriseValue is nonsense for these.
  const adr: CompSummaryInput = {
    price: { regularMarketPrice: 1000, marketCap: 12_000, currency: "USD" },
    defaultKeyStatistics: { enterpriseValue: 999_999_999 },
    financialData: { totalCash: 100, totalDebt: 50, financialCurrency: "EUR" },
    summaryDetail: {},
  };
  const row = buildCompRow("ADR", adr, fundamentals, [], { reportingToTrading: 1.2, tradingToUsd: 1 });
  const v = row.values;

  it("converts statements before dividing and computes its own EV", () => {
    // TTM net income 100 EUR → 120 USD; P/E = 12000 / 120.
    expect(v.pe).toBeCloseTo(100);
    // EV = 12000 + (50 − 100) × 1.2
    expect(v.enterpriseValue).toBeCloseTo(11_940);
    // TTM EBITDA 160 EUR → 192 USD
    expect(v.evEbitda).toBeCloseTo(11_940 / 192);
  });

  it("leaves pure ratios unaffected by FX", () => {
    expect(v.netMargin).toBeCloseTo(0.2);
    expect(v.revenueGrowth).toBeCloseTo(0.25);
  });

  it("reports size in USD", () => {
    const local = buildCompRow("SAP", { ...adr, price: { ...adr.price, currency: "EUR" }, financialData: { financialCurrency: "EUR" } }, fundamentals, [], { reportingToTrading: 1, tradingToUsd: 1.1 });
    expect(local.values.marketCap).toBeCloseTo(13_200);
  });
});

describe("ntmEps", () => {
  const trend = [
    { period: "0y", endDate: "2027-01-31T00:00:00.000Z", earningsEstimate: { avg: 10 } },
    { period: "+1y", endDate: "2028-01-31T00:00:00.000Z", earningsEstimate: { avg: 20 } },
  ];
  it("blends current and next fiscal year by time left in the year", () => {
    // ~73 days left of the current year → mostly next year's estimate.
    expect(ntmEps(trend, new Date("2026-11-19T00:00:00Z"))).toBeCloseTo(10 * 0.2 + 20 * 0.8, 1);
    // Right at the start of the fiscal year → nearly all current year.
    expect(ntmEps(trend, new Date("2026-02-01T00:00:00Z"))).toBeCloseTo(10, 0);
  });
  it("is null without both estimates", () => {
    expect(ntmEps([trend[0]], new Date())).toBeNull();
    expect(ntmEps(null, new Date())).toBeNull();
  });
  it("drives forward P/E for same-currency listings", () => {
    const row = buildCompRow("FWD", { ...summary, earningsTrend: { trend } }, fundamentals, [], undefined, new Date("2026-02-01T00:00:00Z"));
    expect(row.values.forwardPe).toBeCloseTo(6, 0); // 60 / ~10
  });
});
