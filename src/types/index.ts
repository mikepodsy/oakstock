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
}

export interface PortfolioChartPoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number | null;
  costBasis: number;
}

// ─── AI Rebalancing ──────────────────────────────────
export interface RebalanceRequest {
  portfolioId: string;
  goal: "growth" | "income" | "balanced" | "conservative";
  riskTolerance: "low" | "medium" | "high";
  investmentHorizon: "short" | "medium" | "long";
  additionalCapital?: number;
}

export interface RebalanceSuggestion {
  ticker: string;
  name: string;
  currentAllocation: number;
  suggestedAllocation: number;
  action: "buy" | "sell" | "hold";
  sharesToTrade: number;
  reasoning: string;
}

// ─── Fundamentals Time Series ────────────────────────
export interface FinancialStatement {
  date: string;
  revenue: number | null;
  ebitda: number | null;
  freeCashFlow: number | null;
  netIncome: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  costOfRevenue: number | null;
  eps: number | null;
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
