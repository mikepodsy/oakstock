import { describe, it, expect } from "vitest";
import {
  SUMMARY_ROWS,
  annualLabel,
  latestPeriods,
  quarterlyLabel,
} from "./financialSummary";
import type { FinancialStatement } from "@/types";

function statement(
  date: string,
  overrides: Partial<FinancialStatement> = {}
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
    ...overrides,
  };
}

describe("latestPeriods", () => {
  // The API sorts both series oldest-first; the table reads newest-first.
  const series = [
    statement("2021-12-31T00:00:00.000Z"),
    statement("2022-12-31T00:00:00.000Z"),
    statement("2023-12-31T00:00:00.000Z"),
    statement("2024-12-31T00:00:00.000Z"),
    statement("2025-12-31T00:00:00.000Z"),
  ];

  it("returns the most recent N, newest first", () => {
    expect(latestPeriods(series, 4).map((s) => s.date.slice(0, 4))).toEqual([
      "2025",
      "2024",
      "2023",
      "2022",
    ]);
  });

  it("returns everything available when fewer than N periods exist", () => {
    expect(latestPeriods(series.slice(0, 2), 4).map((s) => s.date.slice(0, 4))).toEqual([
      "2022",
      "2021",
    ]);
  });

  it("handles an empty series", () => {
    expect(latestPeriods([], 4)).toEqual([]);
  });

  it("does not mutate the caller's array", () => {
    const input = [...series];
    latestPeriods(input, 4);
    expect(input.map((s) => s.date)).toEqual(series.map((s) => s.date));
  });
});

describe("period labels", () => {
  it("labels fiscal years from the period-end date", () => {
    expect(annualLabel(statement("2025-12-31T00:00:00.000Z"))).toBe("FY 2025");
    expect(annualLabel(statement("2025-06-30T00:00:00.000Z"))).toBe("FY 2025");
  });

  it("reads the year in UTC so a midnight timestamp does not slip a year", () => {
    // In any negative-offset timezone this is Dec 31 2024 locally, which would
    // mislabel a Jan-1 fiscal year end as the prior year.
    expect(annualLabel(statement("2025-01-01T00:00:00.000Z"))).toBe("FY 2025");
  });

  it("labels quarters by the month the period ends in", () => {
    expect(quarterlyLabel(statement("2025-03-31T00:00:00.000Z"))).toBe("Mar '25");
    expect(quarterlyLabel(statement("2025-06-30T00:00:00.000Z"))).toBe("Jun '25");
    expect(quarterlyLabel(statement("2025-09-27T00:00:00.000Z"))).toBe("Sep '25");
    expect(quarterlyLabel(statement("2025-12-31T00:00:00.000Z"))).toBe("Dec '25");
  });

  it("keeps off-calendar fiscal quarters distinct", () => {
    // KO's fiscal quarters end Apr 3 and Jun 30 — both calendar Q2, so a `Qn`
    // label would render two identical adjacent columns.
    const ko = ["2026-06-30", "2026-04-03", "2025-12-31", "2025-09-26"].map((d) =>
      quarterlyLabel(statement(`${d}T00:00:00.000Z`))
    );
    expect(ko).toEqual(["Jun '26", "Apr '26", "Dec '25", "Sep '25"]);
    expect(new Set(ko).size).toBe(4);
  });

  it("reads the quarter month in UTC", () => {
    expect(quarterlyLabel(statement("2025-10-01T00:00:00.000Z"))).toBe("Oct '25");
  });
});

describe("SUMMARY_ROWS", () => {
  function row(label: string) {
    const found = SUMMARY_ROWS.find((r) => r.label === label);
    if (!found) throw new Error(`no row ${label}`);
    return found;
  }

  it("formats currency values compactly and percentages to one decimal", () => {
    const s = statement("2025-12-31T00:00:00.000Z", {
      revenue: 434_298_000_000,
      grossProfit: 200_000_000_000,
    });
    expect(row("Revenue").fmt(s)).toBe("$434.3B");
    expect(row("Gross Margin").fmt(s)).toBe("46.1%");
  });

  it("renders an em dash for missing values rather than 0 or NaN", () => {
    const empty = statement("2025-12-31T00:00:00.000Z");
    for (const r of SUMMARY_ROWS) {
      expect(r.fmt(empty)).toBe("—");
    }
  });

  it("guards margin and ratio rows against a zero denominator", () => {
    const zeroed = statement("2025-12-31T00:00:00.000Z", {
      revenue: 0,
      grossProfit: 5,
      netIncome: 5,
      totalDebt: 100,
      stockholdersEquity: 0,
    });
    expect(zeroed.revenue).toBe(0);
    expect(row("Gross Margin").fmt(zeroed)).toBe("—");
    expect(row("Net Margin").fmt(zeroed)).toBe("—");
    expect(row("Debt / Equity").fmt(zeroed)).toBe("—");
  });

  it("computes debt to equity as a plain ratio", () => {
    const s = statement("2025-12-31T00:00:00.000Z", {
      totalDebt: 150,
      stockholdersEquity: 100,
    });
    expect(row("Debt / Equity").fmt(s)).toBe("1.50");
  });

  it("shows cash outflows as positive magnitudes", () => {
    const s = statement("2025-12-31T00:00:00.000Z", {
      capex: 11_000_000_000,
      dividendsPaid: 15_000_000_000,
    });
    expect(row("Capital Expenditure").fmt(s)).toBe("$11B");
    expect(row("Dividends Paid").fmt(s)).toBe("$15B");
  });
});
