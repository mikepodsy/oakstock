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
}

// ─── Watchlist ───────────────────────────────────────
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
  currency: string;
}

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

// ─── Economic Calendar ───────────────────────────────
export interface CalendarEvent {
  date: string;
  title: string;
  type: "earnings" | "rate_decision" | "economic_data";
  relevantTicker?: string;
}
