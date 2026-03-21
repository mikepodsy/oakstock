import type { DcfInputs, DcfResult, SensitivityCell, FundamentalsData, QuoteData } from "@/types";

export function calculateDcf(inputs: DcfInputs): DcfResult {
  const {
    startingFcf,
    phase1Years,
    phase1GrowthRate,
    phase2Years,
    phase2GrowthRate,
    terminalGrowthRate,
    discountRate,
    totalDebt,
    sharesOutstanding,
  } = inputs;

  const projectedFcf: Array<{ year: number; fcf: number }> = [];
  let presentValueSum = 0;
  let fcf = startingFcf;

  // Phase 1: high growth
  for (let year = 1; year <= phase1Years; year++) {
    fcf = fcf * (1 + phase1GrowthRate);
    presentValueSum += fcf / Math.pow(1 + discountRate, year);
    projectedFcf.push({ year, fcf });
  }

  // Phase 2: stable growth
  for (let year = phase1Years + 1; year <= phase1Years + phase2Years; year++) {
    fcf = fcf * (1 + phase2GrowthRate);
    presentValueSum += fcf / Math.pow(1 + discountRate, year);
    projectedFcf.push({ year, fcf });
  }

  // Terminal value (perpetuity growth)
  const totalYears = phase1Years + phase2Years;
  const terminalFcf = fcf * (1 + terminalGrowthRate);
  const terminalValue = terminalFcf / (discountRate - terminalGrowthRate);
  const pvTerminal = terminalValue / Math.pow(1 + discountRate, totalYears);

  const enterpriseValue = presentValueSum + pvTerminal;
  const equityValue = Math.max(enterpriseValue - totalDebt, 0);
  const intrinsicValuePerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0;

  return { intrinsicValuePerShare, enterpriseValue, equityValue, projectedFcf };
}

export function calculateSensitivity(
  baseInputs: DcfInputs,
  growthRates: number[],
  discountRates: number[]
): SensitivityCell[][] {
  return growthRates.map((growthRate) =>
    discountRates.map((discountRate) => {
      const result = calculateDcf({
        ...baseInputs,
        phase1GrowthRate: growthRate,
        discountRate,
      });
      return { growthRate, discountRate, intrinsicValue: result.intrinsicValuePerShare };
    })
  );
}

export function getDefaultDcfInputs(
  fundamentals: FundamentalsData,
  quote: QuoteData
): DcfInputs | null {
  if (!fundamentals.annual.length) return null;

  const latest = fundamentals.annual[fundamentals.annual.length - 1];
  const startingFcf = latest.freeCashFlow;
  if (startingFcf == null || startingFcf === 0) return null;

  const sharesOutstanding =
    quote.marketCap && quote.currentPrice > 0
      ? quote.marketCap / quote.currentPrice
      : 0;

  return {
    startingFcf,
    phase1Years: 5,
    phase1GrowthRate: 0.2,
    phase2Years: 5,
    phase2GrowthRate: 0.08,
    terminalGrowthRate: 0.03,
    discountRate: 0.1,
    totalDebt: latest.totalDebt ?? 0,
    sharesOutstanding,
  };
}

/** Generate a range of rates centered around a base value */
export function rateRange(base: number, steps: number[], clampMin = 0.01): number[] {
  return steps.map((s) => Math.max(base + s, clampMin));
}
