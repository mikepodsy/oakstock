import { describe, it, expect } from "vitest";
import { parseCompanyFacts, type CompanyFacts } from "./parse";

// A single FY fact (2013-07-01 → 2014-06-30 ≈ 364 days, classifies as "FY").
const fy = (val: number) => ({
  units: {
    USD: [
      { start: "2013-07-01", end: "2014-06-30", val, filed: "2014-07-31", form: "10-K" },
    ],
  },
});

function factsWith(concepts: Record<string, number>): CompanyFacts {
  return {
    facts: {
      "us-gaap": Object.fromEntries(
        Object.entries(concepts).map(([k, v]) => [k, fy(v)]),
      ),
    },
  };
}

describe("parseCompanyFacts concept coverage", () => {
  // Regression guard for the MSFT-style gap: operating cash flow tagged only
  // under the ...ContinuingOperations variant in certain years.
  it("reads operating cash flow from the ContinuingOperations variant", () => {
    const cf = factsWith({
      Revenues: 1000,
      NetIncomeLoss: 200,
      NetCashProvidedByUsedInOperatingActivitiesContinuingOperations: 321,
    });
    const data = parseCompanyFacts("TEST", cf);
    expect(data?.annual[0].operatingCashFlow).toBe(321);
  });

  it("reads common dividends from the PaymentsOfDividendsCommonStock tag", () => {
    const cf = factsWith({
      Revenues: 1000,
      NetIncomeLoss: 200,
      PaymentsOfDividendsCommonStock: 55,
    });
    const data = parseCompanyFacts("TEST", cf);
    expect(data?.annual[0].dividendsPaid).toBe(55);
  });

  it("derives free cash flow once OCF resolves via the variant tag", () => {
    const cf = factsWith({
      Revenues: 1000,
      NetIncomeLoss: 200,
      NetCashProvidedByUsedInOperatingActivitiesContinuingOperations: 400,
      PaymentsToAcquirePropertyPlantAndEquipment: 150,
    });
    const data = parseCompanyFacts("TEST", cf);
    expect(data?.annual[0].freeCashFlow).toBe(250);
  });
});
