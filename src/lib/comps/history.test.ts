import { describe, expect, it } from "vitest";
import type { FinancialStatement } from "@/types";
import { combineHistory, monthEnds, peSeries, sharesAsOf, ttmAsOf } from "./history";

const q = (date: string, netIncome: number | null) =>
  ({ date: `${date}T00:00:00.000Z`, netIncome } as unknown as FinancialStatement);

const quarterly = [
  q("2024-03-31", 10),
  q("2024-06-30", 10),
  q("2024-09-30", 10),
  q("2024-12-31", 10),
  q("2025-03-31", 20),
];

describe("ttmAsOf", () => {
  it("only counts quarters past the reporting lag", () => {
    // Q4-24 (Dec 31) isn't counted until mid-February.
    expect(ttmAsOf(quarterly, "netIncome", "2025-02-01")).toBeNull();
    expect(ttmAsOf(quarterly, "netIncome", "2025-02-20")).toBe(40);
  });
  it("picks up a quarter once it would have been reported", () => {
    expect(ttmAsOf(quarterly, "netIncome", "2025-05-31")).toBe(50);
  });
  it("is null with a missing quarter in the window", () => {
    const gap = quarterly.map((x, i) => (i === 2 ? { ...x, netIncome: null } : x));
    expect(ttmAsOf(gap, "netIncome", "2025-02-20")).toBeNull();
  });
});

describe("sharesAsOf", () => {
  const h = [
    { date: "2023-12-31", shares: 110 },
    { date: "2024-12-31", shares: 100 },
  ];
  it("takes the latest count on or before the date", () => {
    expect(sharesAsOf(h, "2024-06-30")).toBe(110);
    expect(sharesAsOf(h, "2025-06-30")).toBe(100);
  });
  it("uses the earliest count before history starts", () => {
    expect(sharesAsOf(h, "2020-01-01")).toBe(110);
  });
  it("is null without history", () => {
    expect(sharesAsOf([], "2025-01-01")).toBeNull();
  });
});

describe("monthEnds / peSeries", () => {
  const prices = [
    { date: "2025-05-01", close: 90 },
    { date: "2025-05-30", close: 100 },
    { date: "2025-06-02", close: 110 },
  ];
  const shares = [{ date: "2024-12-31", shares: 10 }];

  it("keeps the last close per month", () => {
    expect(monthEnds(prices).map((p) => p.close)).toEqual([100, 110]);
  });
  it("is market cap ÷ TTM net income", () => {
    expect(peSeries(prices, quarterly, shares)).toEqual([
      { date: "2025-05", pe: 20 }, // 100 × 10 / 50
      { date: "2025-06", pe: 22 },
    ]);
  });
  it("applies FX and the ADR share scale", () => {
    const [p] = peSeries(prices, quarterly, shares, { fx: 2, shareScale: 0.5 });
    expect(p.pe).toBeCloseTo(5); // 100 × 10 × 0.5 / (50 × 2)
  });
  it("marks losses NM", () => {
    const losses = quarterly.map((x) => ({ ...x, netIncome: -1 }));
    expect(peSeries(prices, losses, shares)[0].pe).toBeNull();
  });
});

describe("combineHistory", () => {
  it("aligns peers by month and takes the median", () => {
    const out = combineHistory(
      [{ date: "2025-01", pe: 30 }, { date: "2025-02", pe: 31 }],
      [
        [{ date: "2025-01", pe: 10 }, { date: "2025-02", pe: null }],
        [{ date: "2025-01", pe: 20 }, { date: "2025-02", pe: 22 }],
      ]
    );
    expect(out).toEqual([
      { date: "2025-01", target: 30, peerMedian: 15, peerCount: 2 },
      { date: "2025-02", target: 31, peerMedian: 22, peerCount: 1 },
    ]);
  });
});
