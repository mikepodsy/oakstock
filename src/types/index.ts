// ─── Portfolio ───────────────────────────────────────
export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  createdAt: string; // ISO date
  benchmark: string; // Ticker to benchmark against, e.g., "SPY", "XIU.TO"
  holdings: Holding[];
}

// ─── Holdings & Lots ─────────────────────────────────
export interface Holding {
  id: string;
  ticker: string; // e.g., "VOO", "XIU.TO"
  name: string; // e.g., "Vanguard S&P 500 ETF"
  currency: "CAD" | "USD";
  lots: Lot[];
  notes?: string;
}

export interface Lot {
  id: string;
  shares: number;
  costPerShare: number;
  purchaseDate: string; // ISO date
  notes?: string;
}

// ─── Computed (derived at runtime, not stored) ───────
export interface HoldingWithQuote extends Holding {
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  totalShares: number;
  avgCostBasis: number;
  marketValue: number;
  totalCost: number;
  gainLoss: number;
  gainLossPercent: number;
  peRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  sector?: string;
  website?: string;
}

// ─── Watchlist ───────────────────────────────────────
export interface Watchlist {
  id: string;
  name: string;
  createdAt: string;
  items: WatchlistItem[];
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  addedAt: string;
  targetPrice?: number;
  notes?: string;
}

// ─── Market Data ─────────────────────────────────────
export interface QuoteData {
  ticker: string;
  name: string;
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  marketCap?: number;
  peRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  sector?: string;
  website?: string;
  currency: string;
  extendedHours?: {
    session: "pre" | "post";
    changePercent: number; // already scaled to a percent, e.g. +0.42
    price: number;
  };
}

export interface FinancialData {
  ticker: string;
  peRatio: number | null;
  eps: number | null;
  revenue: number | null;
  profitMargin: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  description: string | null;
  analystRating: string | null;
  targetPrice: number | null;
  website: string | null;
}

export type PerformancePeriod = '1M' | '3M' | 'YTD' | '1Y' | '3Y' | '5Y';
export type PerformanceReturns = Record<PerformancePeriod, number | null>;

export interface HistoricalDataPoint {
  date: string; // ISO date
  close: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface QuestradeCandle {
  time: string; // ISO timestamp (Questrade candle start)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Options Strike Breakdown ────────────────────────
// Which expiries to aggregate for the strike-breakdown histogram. Kept as the
// API's fallback when no explicit expiry list is supplied.
export type ExpiryWindow = "front" | "2w" | "monthly" | "all";

// How each strike histogram renders: "net" = signed diverging bars
// (calls − puts), "split" = separate call and put bars.
export type StrikeView = "net" | "split";

// One row per strike, with call/put open-interest and volume summed across the
// selected expiries.
export interface OptionStrikeRow {
  strike: number;
  callOI: number;
  putOI: number;
  callVol: number;
  putVol: number;
  // Per-side dealer gamma exposure at this strike, in dollars of hedging per 1%
  // move in spot. 0 when greeks/spot are unavailable.
  callGex: number;
  putGex: number;
  // Net dealer gamma exposure (callGex − putGex).
  gex: number;
}

export interface OptionsExpiry {
  date: string; // ISO expiry date (YYYY-MM-DD)
  label: string; // e.g. "Jun 27"
  isZeroDte: boolean; // true when this expiry is today's date (market TZ)
}

export interface OptionsChainResponse {
  rows: OptionStrikeRow[];
  expiries: OptionsExpiry[]; // every listed expiry (for the window dropdown)
  spot: number | null; // underlying last price
  asOf: string; // ISO timestamp of this aggregation
  // True when at least one contract reported a non-null gamma — i.e. the GEX
  // panel has data to work with.
  hasGreeks: boolean;
  // Sum of per-strike net GEX across the window (dollars per 1% move).
  netGex: number;
  // Approximate zero-gamma flip price (cumulative net GEX crosses zero), or null
  // when it never crosses within the strike band.
  flip: number | null;
}

export interface PortfolioChartPoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number | null;
  costBasis: number;
}

// ─── Fundamentals Time Series ────────────────────────
export interface FinancialStatement {
  date: string;
  revenue: number | null;
  ebitda: number | null;
  freeCashFlow: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  netIncome: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  costOfRevenue: number | null;
  eps: number | null;
  epsBasic: number | null;
  buybacks: number | null;
  dividendsPaid: number | null;
  totalDebt: number | null;
  stockholdersEquity: number | null;
}

export interface FundamentalsData {
  ticker: string;
  quarterly: FinancialStatement[];
  annual: FinancialStatement[];
}

// ─── Calendar ───────────────────────────────────────
export type CalendarType = 'earnings' | 'dividends' | 'economic' | 'ipo';

export interface EarningsEvent {
  date: string;
  symbol: string;
  company: string;
  epsEstimated: number | null;
  epsActual: number | null;
  revenueEstimated: number | null;
  revenueActual: number | null;
  time: 'bmo' | 'amc' | null;
  isPortfolioStock: boolean;
}

export interface DividendEvent {
  date: string;
  symbol: string;
  company: string;
  dividend: number;
  yield: number | null;
  paymentDate: string | null;
  recordDate: string | null;
  isPortfolioStock: boolean;
}

export interface EconomicEvent {
  date: string;
  event: string;
  country: string;
  previous: number | null;
  forecast: number | null;
  actual: number | null;
  impact: 'High' | 'Medium' | 'Low';
}

export interface IpoEvent {
  date: string;
  symbol: string;
  company: string;
  exchange: string;
  priceRange: string | null;
  sharesOffered: number | null;
  marketCap: number | null;
  isPortfolioStock: boolean;
}

export type CalendarEvent = EarningsEvent | DividendEvent | EconomicEvent | IpoEvent;

// ─── Dividends Portfolio ────────────────────────────
export interface DividendHolding {
  holdingId: string;
  portfolioId: string;
  portfolioName: string;
  ticker: string;
  name: string;
  currency: "CAD" | "USD";
  totalShares: number;
  avgCostBasis: number;
  currentPrice: number;
  dividendYield: number;
  annualDividendPerShare: number;
  annualIncome: number;
  yieldOnCost: number;
}

export interface DividendPayment {
  symbol: string;
  date: string;
  dividend: number;
  totalReceived: number;
}

export interface MonthlyIncome {
  month: string;
  totalIncome: number;
  byTicker: { ticker: string; amount: number }[];
}

export interface BatchFinancialData {
  ticker: string;
  dividendYield: number | null;
  dividendRate: number | null;
  currentPrice: number | null;
  error?: boolean;
}

// ─── DCF Calculator ──────────────────────────────────
export interface DcfInputs {
  startingFcf: number;
  phase1Years: number;
  phase1GrowthRate: number; // decimal (0.20 = 20%)
  phase2Years: number;
  phase2GrowthRate: number;
  terminalGrowthRate: number;
  discountRate: number; // WACC
  totalDebt: number;
  sharesOutstanding: number;
}

export interface DcfResult {
  intrinsicValuePerShare: number;
  enterpriseValue: number;
  equityValue: number;
  projectedFcf: Array<{ year: number; fcf: number }>;
}

export interface SensitivityCell {
  growthRate: number;
  discountRate: number;
  intrinsicValue: number;
}

// ─── Economic Indicators ─────────────────────────────
export type EconomicIndicator = 'inflation' | 'unemployment' | 'oil' | 'tips' | 'fedrate';
export type MarketIndicator = 'gold' | 'dxy' | 'sp500' | 'dowjones' | 'vix' | 'es' | 'nq' | 'rspSpy' | 'vixeqVix';
export type EconomicTimeRange = '1y' | '2y' | '5y' | '10y' | 'max';

export interface EconomicDataPoint {
  date: string;
  value: number;
}

export interface EconomicIndicatorData {
  indicator: EconomicIndicator | MarketIndicator;
  name: string;
  currentValue: number | null;
  previousValue: number | null;
  change: number | null;
  unit: string;
  data: EconomicDataPoint[];
  lastUpdated: string;
}

// ─── Treasury Bonds ─────────────────────────────────
export type TreasuryMaturity = '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | '20y' | '30y';

export interface TreasurySeriesData {
  maturity: TreasuryMaturity;
  label: string;
  currentValue: number | null;
  previousValue: number | null;
  change: number | null;
  data: EconomicDataPoint[];
}

export interface TreasuryBundleData {
  series: TreasurySeriesData[];
  lastUpdated: string;
}

// ─── COT Report ───────────────────────────────────────
export type CotReportType = "tff" | "disagg";

// Instruments are bucketed into these groups for the grouped selector dropdowns.
export type CotGroup = "Indices" | "Metals" | "FX" | "Energy" | "Bonds";

export interface CotInstrument {
  label: string;
  cftcName: string;
  reportType: CotReportType;
  group: CotGroup;
}

export interface CotCategory {
  name: string;
  longs: number;
  shorts: number;
  net: number;
  netChange: number;
  // 3-year net-positioning index (COT Index), 0–100. ≥80 bullish, ≤20 bearish.
  // null when there isn't enough history or the 3yr range is flat.
  index: number | null;
}

// Each history week carries full category data (net change vs the prior week and
// the rolling 3-year index) so any past report renders identically to the latest.
export type CotWeekCategory = CotCategory;

export interface CotWeek {
  reportDate: string;
  categories: CotWeekCategory[];
}

// A self-contained set of categories + history (used for the legacy report
// shown alongside the detailed TFF/disagg breakdown).
export interface CotGroupSet {
  categories: CotCategory[];
  history: CotWeek[];
}

export interface CotReport {
  instrument: string;
  group: CotGroup;
  reportDate: string;
  reportType: CotReportType;
  categories: CotCategory[];
  history: CotWeek[];
  // Legacy report groups (Commercial / Non-Commercial / Non-Reportable).
  // null if the legacy dataset had no match / failed to load for this instrument.
  legacy: CotGroupSet | null;
}
