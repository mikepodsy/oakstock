// Types for the Option Position Builder (/options/[ticker]).
// Kept separate from the GEX/strike-breakdown types in ./index.ts.
import type { OptionsExpiry } from "./index";

export type OptionType = "call" | "put";
export type OptionAction = "buy" | "sell";
// What a leg actually is. Most legs are call/put; covered calls add a stock leg.
export type LegInstrument = "call" | "put" | "stock";

// The strategies the selector can scaffold. "custom" starts blank.
export type StrategyType =
  | "long_call"
  | "long_put"
  | "covered_call"
  | "cash_secured_put"
  | "bull_call_spread"
  | "bear_put_spread"
  | "bull_put_spread"
  | "bear_call_spread"
  | "iron_condor"
  | "iron_butterfly"
  | "straddle"
  | "strangle"
  | "custom";

// One contract's market data (a single side at a single strike/expiry), as
// returned by /api/options/chain. mid = (bid+ask)/2, falling back to last.
export interface ContractQuote {
  bid: number | null;
  ask: number | null;
  last: number | null;
  mid: number | null;
  iv: number | null; // implied volatility as a fraction (0.57 = 57%)
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  openInterest: number | null;
  volume: number | null;
}

// One strike row with both sides for a single expiry.
export interface OptionStrikeQuotes {
  strike: number;
  call: ContractQuote;
  put: ContractQuote;
}

// Response from /api/options/chain for a single expiry.
export interface OptionChainData {
  ticker: string;
  spot: number | null;
  asOf: string; // ISO timestamp
  expiry: string; // the resolved expiry these strikes belong to (YYYY-MM-DD)
  expiries: OptionsExpiry[]; // all listed expiries (for the dropdown)
  strikes: OptionStrikeQuotes[];
}

// A single leg of the position the user is building.
export interface OptionLeg {
  id: string; // stable client id
  action: OptionAction;
  type: LegInstrument;
  qty: number; // contracts (each = 100 shares); stock legs = units of 100 shares
  expiry: string | null; // YYYY-MM-DD, null until chosen
  strike: number | null; // null until chosen
  mid: number | null; // entry price per share (premium)
  // Market IV from the chain (fraction). Used for BS repricing.
  iv: number | null;
  // When set, overrides the market IV for this leg's BS pricing/greeks.
  ivOverride: number | null;
  // Live greeks from Questrade at entry (per share), when available.
  greeks: LegGreeks | null;
}

export interface LegGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

// One point on the payoff diagram.
export interface PayoffPoint {
  price: number; // underlying price
  expiry: number; // P&L at expiration (intrinsic), dollars
  today: number; // P&L at the current valuation date (BS), dollars
  // Intermediate-date curves keyed by elapsed fraction ("0.25"|"0.5"|"0.75").
  [key: `t${string}`]: number;
}

export interface NetGreeks {
  delta: number;
  gamma: number;
  theta: number; // per day
  vega: number;
  rho: number;
}

export interface PerLegGreeks extends NetGreeks {
  legId: string;
}

// Full output of the payoff engine for a given set of legs + valuation date.
export interface PayoffResult {
  points: PayoffPoint[];
  breakevens: number[];
  maxProfit: number | null; // null = unlimited
  maxLoss: number | null; // null = unlimited
  netDebit: number; // >0 debit (you pay), <0 credit (you receive), dollars
  winRate: number | null; // 0..1, probability of profit at expiry
  netGreeks: NetGreeks;
  perLeg: PerLegGreeks[];
  priceRange: [number, number];
}
