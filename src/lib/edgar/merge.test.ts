import { describe, it, expect } from "vitest";
import { mergeFundamentals } from "./merge";
import type { FinancialStatement, FundamentalsData } from "@/types";

// Build a statement with all fields null except the ones provided.
function stmt(
  date: string,
  fields: Partial<FinancialStatement> = {},
): FinancialStatement {
  return {
    date,
    revenue: null,
    ebitda: null,
    freeCashFlow: null,
    operatingCashFlow: null,
    capex: null,
    netIncome: null,
    grossProfit: null,
    operatingIncome: null,
    costOfRevenue: null,
    eps: null,
    epsBasic: null,
    buybacks: null,
    dividendsPaid: null,
    totalDebt: null,
    stockholdersEquity: null,
    ...fields,
  };
}

const wrap = (annual: FinancialStatement[]): FundamentalsData => ({
  ticker: "TEST",
  quarterly: [],
  annual,
});

describe("mergeFundamentals", () => {
  it("fills a primary null cell from the fallback for the same period", () => {
    const primary = wrap([stmt("2024-06-30T00:00:00.000Z", { revenue: 100 })]);
    const fallback = wrap([stmt("2024-06-30T00:00:00.000Z", { ebitda: 42 })]);
    const merged = mergeFundamentals(primary, fallback);
    expect(merged.annual[0].revenue).toBe(100);
    expect(merged.annual[0].ebitda).toBe(42);
  });

  it("never overwrites a value the primary already has", () => {
    const primary = wrap([stmt("2024-06-30T00:00:00.000Z", { revenue: 100 })]);
    const fallback = wrap([stmt("2024-06-30T00:00:00.000Z", { revenue: 999 })]);
    const merged = mergeFundamentals(primary, fallback);
    expect(merged.annual[0].revenue).toBe(100);
  });

  it("matches periods whose dates differ by a few days (fiscal-end drift)", () => {
    const primary = wrap([stmt("2024-06-30T00:00:00.000Z", { revenue: 100 })]);
    const fallback = wrap([stmt("2024-06-28T00:00:00.000Z", { ebitda: 42 })]);
    const merged = mergeFundamentals(primary, fallback);
    expect(merged.annual[0].ebitda).toBe(42);
  });

  it("does not match periods that are a different fiscal year apart", () => {
    const primary = wrap([stmt("2024-06-30T00:00:00.000Z", { revenue: 100 })]);
    const fallback = wrap([stmt("2023-06-30T00:00:00.000Z", { ebitda: 42 })]);
    const merged = mergeFundamentals(primary, fallback);
    // 2024 row stays unfilled; 2023 fallback row is appended, not merged in.
    expect(merged.annual.find((s) => s.date.startsWith("2024"))?.ebitda).toBeNull();
    expect(merged.annual).toHaveLength(2);
  });

  it("appends fallback-only periods the primary lacks entirely", () => {
    const primary = wrap([stmt("2024-06-30T00:00:00.000Z", { revenue: 100 })]);
    const fallback = wrap([
      stmt("2024-06-30T00:00:00.000Z", { ebitda: 42 }),
      stmt("2025-06-30T00:00:00.000Z", { revenue: 200 }),
    ]);
    const merged = mergeFundamentals(primary, fallback);
    expect(merged.annual).toHaveLength(2);
    expect(merged.annual[1].date.startsWith("2025")).toBe(true);
    expect(merged.annual[1].revenue).toBe(200);
  });
});
