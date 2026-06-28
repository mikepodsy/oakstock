// Strategy → leg-template scaffolding for the position builder.
//
// A template describes each leg's instrument/action and a strike "hint" relative
// to spot. When the user picks a strategy we resolve hints to the nearest
// available strikes for the chosen expiry, leaving the user to fine-tune.
import type { StrategyType, OptionAction, LegInstrument } from "@/types/options";

// Strike hint relative to the at-the-money strike, in "steps" along the strike
// ladder (e.g. -1 = one strike below ATM). "atm" = nearest to spot.
export interface LegTemplate {
  instrument: LegInstrument;
  action: OptionAction;
  qty: number;
  strikeStep: number; // offset in strike-ladder steps from ATM (stock legs: 0)
}

export interface StrategyDef {
  value: StrategyType;
  label: string;
  legs: LegTemplate[];
}

const opt = (
  instrument: "call" | "put",
  action: OptionAction,
  strikeStep: number,
  qty = 1,
): LegTemplate => ({ instrument, action, qty, strikeStep });

export const STRATEGIES: StrategyDef[] = [
  { value: "long_call", label: "Long Call", legs: [opt("call", "buy", 0)] },
  { value: "long_put", label: "Long Put", legs: [opt("put", "buy", 0)] },
  {
    value: "covered_call",
    label: "Covered Call",
    legs: [
      { instrument: "stock", action: "buy", qty: 1, strikeStep: 0 },
      opt("call", "sell", 2),
    ],
  },
  {
    value: "cash_secured_put",
    label: "Cash-Secured Put",
    legs: [opt("put", "sell", -2)],
  },
  {
    value: "bull_call_spread",
    label: "Bull Call Spread",
    legs: [opt("call", "buy", 0), opt("call", "sell", 2)],
  },
  {
    value: "bear_put_spread",
    label: "Bear Put Spread",
    legs: [opt("put", "buy", 0), opt("put", "sell", -2)],
  },
  {
    value: "bull_put_spread",
    label: "Bull Put Spread",
    legs: [opt("put", "sell", 0), opt("put", "buy", -2)],
  },
  {
    value: "bear_call_spread",
    label: "Bear Call Spread",
    legs: [opt("call", "sell", 0), opt("call", "buy", 2)],
  },
  {
    value: "iron_condor",
    label: "Iron Condor",
    legs: [
      opt("put", "buy", -4),
      opt("put", "sell", -2),
      opt("call", "sell", 2),
      opt("call", "buy", 4),
    ],
  },
  {
    value: "iron_butterfly",
    label: "Iron Butterfly",
    legs: [
      opt("put", "buy", -2),
      opt("put", "sell", 0),
      opt("call", "sell", 0),
      opt("call", "buy", 2),
    ],
  },
  {
    value: "straddle",
    label: "Straddle",
    legs: [opt("call", "buy", 0), opt("put", "buy", 0)],
  },
  {
    value: "strangle",
    label: "Strangle",
    legs: [opt("call", "buy", 2), opt("put", "buy", -2)],
  },
  { value: "custom", label: "Custom", legs: [] },
];

export const STRATEGY_BY_VALUE: Record<StrategyType, StrategyDef> =
  Object.fromEntries(STRATEGIES.map((s) => [s.value, s])) as Record<
    StrategyType,
    StrategyDef
  >;

// Index of the strike in a sorted ladder nearest to spot (the ATM anchor).
export function atmIndex(strikes: number[], spot: number): number {
  if (strikes.length === 0) return -1;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < strikes.length; i++) {
    const d = Math.abs(strikes[i] - spot);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

// Resolve a template's strikeStep against a sorted strike ladder + spot, clamped
// to the ladder bounds. Returns null when there are no strikes.
export function resolveStrike(
  strikes: number[],
  spot: number,
  strikeStep: number,
): number | null {
  if (strikes.length === 0) return null;
  const atm = atmIndex(strikes, spot);
  const idx = Math.min(Math.max(atm + strikeStep, 0), strikes.length - 1);
  return strikes[idx];
}
