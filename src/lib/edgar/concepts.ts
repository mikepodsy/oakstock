// XBRL us-gaap concept mappings. Tags vary by company and era, so each field
// lists candidate concepts in priority order (modern/specific first). When
// assembling a period we overlay candidates and the first one present wins,
// which is what stitches together long histories across tag changes
// (e.g. SalesRevenueNet pre-2018 → RevenueFromContractWithCustomer... after).

export interface DurationField {
  candidates: string[];
  // EPS is reported per-period and is NOT linearly additive, so it must come
  // from natively-tagged quarter/year facts only — never reconstructed by
  // subtracting cumulative YTD values.
  derivable: boolean;
}

// Duration (flow) concepts that map 1:1 to a FinancialStatement field.
export const DURATION_FIELDS = {
  revenue: {
    candidates: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
    ],
    derivable: true,
  },
  costOfRevenue: {
    candidates: [
      "CostOfGoodsAndServicesSold",
      "CostOfRevenue",
      "CostOfGoodsSold",
    ],
    derivable: true,
  },
  grossProfit: { candidates: ["GrossProfit"], derivable: true },
  operatingIncome: { candidates: ["OperatingIncomeLoss"], derivable: true },
  netIncome: { candidates: ["NetIncomeLoss"], derivable: true },
  operatingCashFlow: {
    candidates: ["NetCashProvidedByUsedInOperatingActivities"],
    derivable: true,
  },
  capex: {
    candidates: [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
    ],
    derivable: true,
  },
  eps: { candidates: ["EarningsPerShareDiluted"], derivable: false },
  epsBasic: { candidates: ["EarningsPerShareBasic"], derivable: false },
  buybacks: {
    candidates: [
      "PaymentsForRepurchaseOfCommonStock",
      "PaymentsForRepurchaseOfEquity",
    ],
    derivable: true,
  },
  dividendsPaid: {
    candidates: ["PaymentsOfDividendsCommon", "PaymentsOfDividends"],
    derivable: true,
  },
} satisfies Record<string, DurationField>;

// Duration helper concepts used only to compute derived metrics. EBITDA needs
// D&A on top of the first-class operatingIncome field. FCF is derived from the
// first-class operatingCashFlow and capex fields, so they aren't repeated here.
export const HELPER_FIELDS = {
  dna: {
    candidates: [
      "DepreciationDepletionAndAmortization",
      "DepreciationAmortizationAndAccretionNet",
      "DepreciationAndAmortization",
      "DepreciationDepletionAndAmortizationNonproductionMethod",
    ],
    derivable: true,
  },
} satisfies Record<string, DurationField>;

// Instant (point-in-time, balance-sheet) concepts. No duration — valued at a
// period-end date.
export const INSTANT_FIELDS = {
  stockholdersEquity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  // No single canonical "total debt" tag exists. Prefer a combined tag; the
  // assembly step falls back to summing long-term + current portions.
  longTermDebt: ["LongTermDebt", "DebtLongtermAndShorttermCombinedAmount"],
  longTermDebtNoncurrent: ["LongTermDebtNoncurrent"],
  longTermDebtCurrent: ["LongTermDebtCurrent", "LongTermDebtCurrentMaturities"],
} satisfies Record<string, string[]>;

export type DurationFieldKey = keyof typeof DURATION_FIELDS;
export type HelperFieldKey = keyof typeof HELPER_FIELDS;
export type InstantFieldKey = keyof typeof INSTANT_FIELDS;
