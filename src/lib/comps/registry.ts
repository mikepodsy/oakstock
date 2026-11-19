// Metric registry for the Comparisons page. Every column, chart axis and
// heatmap colour reads from here, so adding a metric is one entry plus its
// computation in metrics.ts.

export type MetricGroup = "valuation" | "growth" | "profitability" | "balance";

/** How a value is rendered: multiple (12.3x), percent (fraction → %), money (compact $), ratio (1.23). */
export type MetricFormat = "multiple" | "percent" | "money" | "ratio";

/**
 * Which way is "good" for heatmap shading and the cheap/expensive read:
 * "lower" — lower is better/cheaper (P/E), "higher" — higher is better (margins),
 * null — no judgement (size).
 */
export type MetricDirection = "lower" | "higher" | null;

export const METRIC_IDS = [
  // valuation
  "pe",
  "forwardPe",
  "peg",
  "ps",
  "pb",
  "evSales",
  "evEbitda",
  "evEbit",
  "evFcf",
  "pFcf",
  "fcfYield",
  "dividendYield",
  // growth
  "revenueGrowth",
  "epsGrowth",
  "ebitdaGrowth",
  "revenueCagr3y",
  "epsCagr3y",
  // profitability & returns
  "grossMargin",
  "operatingMargin",
  "netMargin",
  "fcfMargin",
  "roe",
  "roa",
  "roic",
  // balance sheet, size & performance
  "marketCap",
  "enterpriseValue",
  "netDebtEbitda",
  "debtEquity",
  "currentRatio",
  "return1m",
  "returnYtd",
  "return1y",
] as const;

export type MetricId = (typeof METRIC_IDS)[number];

export interface MetricDef {
  id: MetricId;
  label: string;
  short: string;
  group: MetricGroup;
  format: MetricFormat;
  direction: MetricDirection;
  description: string;
}

const defs: MetricDef[] = [
  { id: "pe", label: "P/E (TTM)", short: "P/E", group: "valuation", format: "multiple", direction: "lower", description: "Price ÷ trailing-twelve-month diluted EPS" },
  { id: "forwardPe", label: "P/E (Forward)", short: "Fwd P/E", group: "valuation", format: "multiple", direction: "lower", description: "Price ÷ consensus next-year EPS" },
  { id: "peg", label: "PEG", short: "PEG", group: "valuation", format: "ratio", direction: "lower", description: "P/E ÷ EPS growth (%)" },
  { id: "ps", label: "Price / Sales", short: "P/S", group: "valuation", format: "multiple", direction: "lower", description: "Market cap ÷ TTM revenue" },
  { id: "pb", label: "Price / Book", short: "P/B", group: "valuation", format: "multiple", direction: "lower", description: "Price ÷ book value per share" },
  { id: "evSales", label: "EV / Sales", short: "EV/S", group: "valuation", format: "multiple", direction: "lower", description: "Enterprise value ÷ TTM revenue" },
  { id: "evEbitda", label: "EV / EBITDA", short: "EV/EBITDA", group: "valuation", format: "multiple", direction: "lower", description: "Enterprise value ÷ TTM EBITDA" },
  { id: "evEbit", label: "EV / EBIT", short: "EV/EBIT", group: "valuation", format: "multiple", direction: "lower", description: "Enterprise value ÷ TTM operating income" },
  { id: "evFcf", label: "EV / FCF", short: "EV/FCF", group: "valuation", format: "multiple", direction: "lower", description: "Enterprise value ÷ TTM free cash flow" },
  { id: "pFcf", label: "Price / FCF", short: "P/FCF", group: "valuation", format: "multiple", direction: "lower", description: "Market cap ÷ TTM free cash flow" },
  { id: "fcfYield", label: "FCF Yield", short: "FCF Yld", group: "valuation", format: "percent", direction: "higher", description: "TTM free cash flow ÷ market cap" },
  { id: "dividendYield", label: "Dividend Yield", short: "Div Yld", group: "valuation", format: "percent", direction: "higher", description: "Annual dividend ÷ price" },

  { id: "revenueGrowth", label: "Revenue Growth (YoY)", short: "Rev Gr", group: "growth", format: "percent", direction: "higher", description: "TTM revenue vs the prior TTM" },
  { id: "epsGrowth", label: "EPS Growth (YoY)", short: "EPS Gr", group: "growth", format: "percent", direction: "higher", description: "TTM diluted EPS vs the prior TTM" },
  { id: "ebitdaGrowth", label: "EBITDA Growth (YoY)", short: "EBITDA Gr", group: "growth", format: "percent", direction: "higher", description: "TTM EBITDA vs the prior TTM" },
  { id: "revenueCagr3y", label: "Revenue CAGR (3Y)", short: "Rev 3Y", group: "growth", format: "percent", direction: "higher", description: "Compound annual revenue growth over the last 3 fiscal years" },
  { id: "epsCagr3y", label: "EPS CAGR (3Y)", short: "EPS 3Y", group: "growth", format: "percent", direction: "higher", description: "Compound annual EPS growth over the last 3 fiscal years" },

  { id: "grossMargin", label: "Gross Margin", short: "Gross M", group: "profitability", format: "percent", direction: "higher", description: "TTM gross profit ÷ revenue" },
  { id: "operatingMargin", label: "Operating Margin", short: "Op M", group: "profitability", format: "percent", direction: "higher", description: "TTM operating income ÷ revenue" },
  { id: "netMargin", label: "Net Margin", short: "Net M", group: "profitability", format: "percent", direction: "higher", description: "TTM net income ÷ revenue" },
  { id: "fcfMargin", label: "FCF Margin", short: "FCF M", group: "profitability", format: "percent", direction: "higher", description: "TTM free cash flow ÷ revenue" },
  { id: "roe", label: "Return on Equity", short: "ROE", group: "profitability", format: "percent", direction: "higher", description: "TTM net income ÷ shareholders' equity" },
  { id: "roa", label: "Return on Assets", short: "ROA", group: "profitability", format: "percent", direction: "higher", description: "TTM net income ÷ total assets" },
  { id: "roic", label: "Return on Invested Capital", short: "ROIC", group: "profitability", format: "percent", direction: "higher", description: "TTM EBIT × (1 − 21%) ÷ (debt + equity − cash)" },

  { id: "marketCap", label: "Market Cap", short: "Mkt Cap", group: "balance", format: "money", direction: null, description: "Shares outstanding × price" },
  { id: "enterpriseValue", label: "Enterprise Value", short: "EV", group: "balance", format: "money", direction: null, description: "Market cap + debt − cash" },
  { id: "netDebtEbitda", label: "Net Debt / EBITDA", short: "ND/EBITDA", group: "balance", format: "multiple", direction: "lower", description: "(Debt − cash) ÷ TTM EBITDA" },
  { id: "debtEquity", label: "Debt / Equity", short: "D/E", group: "balance", format: "ratio", direction: "lower", description: "Total debt ÷ shareholders' equity" },
  { id: "currentRatio", label: "Current Ratio", short: "Curr", group: "balance", format: "ratio", direction: "higher", description: "Current assets ÷ current liabilities" },
  { id: "return1m", label: "Return (1M)", short: "1M", group: "balance", format: "percent", direction: "higher", description: "Price change over the last month" },
  { id: "returnYtd", label: "Return (YTD)", short: "YTD", group: "balance", format: "percent", direction: "higher", description: "Price change since the start of the year" },
  { id: "return1y", label: "Return (1Y)", short: "1Y", group: "balance", format: "percent", direction: "higher", description: "Price change over the last year" },
];

export const METRICS: Record<MetricId, MetricDef> = Object.fromEntries(
  defs.map((d) => [d.id, d])
) as Record<MetricId, MetricDef>;

export const METRIC_LIST: MetricDef[] = defs;

export const GROUP_LABELS: Record<MetricGroup, string> = {
  valuation: "Valuation",
  growth: "Growth",
  profitability: "Profitability & Returns",
  balance: "Balance Sheet, Size & Performance",
};

export const PRESETS: Record<string, MetricId[]> = {
  Valuation: ["marketCap", "pe", "forwardPe", "evEbitda", "evFcf", "ps", "fcfYield", "revenueGrowth"],
  Growth: ["marketCap", "revenueGrowth", "epsGrowth", "ebitdaGrowth", "revenueCagr3y", "epsCagr3y", "peg"],
  Quality: ["marketCap", "grossMargin", "operatingMargin", "fcfMargin", "roe", "roic", "netDebtEbitda"],
  Performance: ["marketCap", "return1m", "returnYtd", "return1y", "pe", "evEbitda"],
  All: [...METRIC_IDS],
};

export const DEFAULT_PRESET = "Valuation";

export function isMetricId(v: string): v is MetricId {
  return (METRIC_IDS as readonly string[]).includes(v);
}

export function formatMetric(value: number | null | undefined, format: MetricFormat): string {
  if (value == null || !Number.isFinite(value)) return "NM";
  switch (format) {
    case "multiple":
      return `${value.toFixed(1)}x`;
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "ratio":
      return value.toFixed(2);
    case "money": {
      const abs = Math.abs(value);
      const sign = value < 0 ? "-" : "";
      if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
      if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
      if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
      return `${sign}$${abs.toFixed(0)}`;
    }
  }
}
