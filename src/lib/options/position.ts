// Glue between the UI's OptionLeg list and the pure payoff engine: DTE math,
// leg scaffolding from a strategy, and pulling quotes out of a chain.
import type {
  OptionLeg,
  OptionChainData,
  StrategyType,
  ContractQuote,
} from "@/types/options";
import type { PayoffLeg } from "./payoff";
import { STRATEGY_BY_VALUE, resolveStrike } from "./strategies";

const MS_PER_DAY = 86_400_000;

// Expiry resolves to ~4pm ET on the expiration day for DTE purposes.
function expiryMs(expiry: string): number {
  return new Date(`${expiry}T20:00:00Z`).getTime();
}

export function dteDays(expiry: string | null, now = Date.now()): number | null {
  if (!expiry) return null;
  return Math.max(0, Math.ceil((expiryMs(expiry) - now) / MS_PER_DAY));
}

export function dteYears(expiry: string | null, now = Date.now()): number {
  if (!expiry) return 0;
  return Math.max(0, (expiryMs(expiry) - now) / (365 * MS_PER_DAY));
}

// Effective IV for a leg: the override if set, else the market IV.
export function effectiveIv(leg: OptionLeg): number | null {
  return leg.ivOverride ?? leg.iv;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Pull a side's quote from a chain at a given strike, or null if absent.
export function quoteAt(
  chain: OptionChainData | undefined,
  strike: number | null,
  side: "call" | "put",
): ContractQuote | null {
  if (!chain || strike == null) return null;
  const row = chain.strikes.find((s) => s.strike === strike);
  return row ? row[side] : null;
}

// Fill a leg's mid/iv/greeks from the chain for its current strike/expiry.
export function hydrateLeg(
  leg: OptionLeg,
  chains: Record<string, OptionChainData>,
  spot: number | null,
): OptionLeg {
  if (leg.type === "stock") {
    return { ...leg, mid: spot ?? leg.mid, iv: null, greeks: null };
  }
  const chain = leg.expiry ? chains[leg.expiry] : undefined;
  const q = quoteAt(chain, leg.strike, leg.type);
  if (!q) return leg;
  const hasGreeks = q.delta != null && q.gamma != null && q.theta != null;
  return {
    ...leg,
    mid: q.mid ?? leg.mid,
    iv: q.iv ?? leg.iv,
    greeks: hasGreeks
      ? {
          delta: q.delta!,
          gamma: q.gamma!,
          theta: q.theta!,
          vega: q.vega ?? 0,
          rho: q.rho ?? 0,
        }
      : null,
  };
}

// Scaffold legs for a strategy against a chain (nearest expiry + spot).
export function scaffoldStrategy(
  strategy: StrategyType,
  chain: OptionChainData,
  spot: number | null,
): OptionLeg[] {
  const def = STRATEGY_BY_VALUE[strategy];
  if (!def) return [];
  const ladder = chain.strikes.map((s) => s.strike);
  const anchor = spot ?? chain.spot ?? ladder[Math.floor(ladder.length / 2)] ?? 0;

  return def.legs.map((t) => {
    const base: OptionLeg = {
      id: randomId(),
      action: t.action,
      type: t.instrument,
      qty: t.qty,
      expiry: t.instrument === "stock" ? null : chain.expiry,
      strike: t.instrument === "stock" ? null : resolveStrike(ladder, anchor, t.strikeStep),
      mid: null,
      iv: null,
      ivOverride: null,
      greeks: null,
    };
    return hydrateLeg(base, { [chain.expiry]: chain }, anchor);
  });
}

// Map UI legs → engine legs. Legs missing a strike/premium are dropped (the
// chart only draws complete legs).
export function toPayoffLegs(
  legs: OptionLeg[],
  spot: number | null,
  now = Date.now(),
): PayoffLeg[] {
  const out: PayoffLeg[] = [];
  for (const l of legs) {
    if (l.type === "stock") {
      const premium = l.mid ?? spot;
      if (premium == null) continue;
      out.push({
        instrument: "stock",
        action: l.action,
        qty: l.qty,
        strike: 0,
        premium,
        iv: null,
        dteYears: 0,
        greeks: { delta: 1, gamma: 0, theta: 0, vega: 0, rho: 0 },
      });
      continue;
    }
    if (l.strike == null || l.mid == null) continue;
    const iv = effectiveIv(l);
    // When the user overrides IV, recompute greeks from BS (drop live greeks).
    const greeks = l.ivOverride != null ? null : l.greeks;
    out.push({
      instrument: l.type,
      action: l.action,
      qty: l.qty,
      strike: l.strike,
      premium: l.mid,
      iv,
      dteYears: dteYears(l.expiry, now),
      greeks,
    });
  }
  return out;
}

// The position's representative ATM IV for the expected-move bands / win rate:
// the IV of the nearest-to-spot option leg.
export function positionAtmIv(legs: OptionLeg[], spot: number | null): number | null {
  if (spot == null) return null;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const l of legs) {
    if (l.type === "stock" || l.strike == null) continue;
    const iv = effectiveIv(l);
    if (iv == null) continue;
    const d = Math.abs(l.strike - spot);
    if (d < bestDist) {
      bestDist = d;
      best = iv;
    }
  }
  return best;
}
