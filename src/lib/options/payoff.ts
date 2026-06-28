// Payoff engine for the Option Position Builder.
//
// Pure functions only — no React, no fetching. Given a set of normalized legs
// and a spot price, it produces the payoff-diagram points (expiry / valuation /
// intermediate curves), breakevens, max profit/loss (with unlimited detection),
// net debit/credit, win rate, and net + per-leg greeks.
//
// Sign convention: long (buy) = +1, short (sell) = -1. Each option contract is
// 100 shares; a "stock" leg is 100 shares per unit qty too (so a covered call is
// 1 stock unit + 1 short call). P&L is in dollars.
import { price, greeks, intrinsic, normCdf } from "./blackScholes";
import type {
  OptionAction,
  LegInstrument,
  LegGreeks,
  NetGreeks,
  PerLegGreeks,
  PayoffPoint,
  PayoffResult,
} from "@/types/options";

// Normalized leg the engine operates on. The UI maps OptionLeg → PayoffLeg.
export interface PayoffLeg {
  instrument: LegInstrument;
  action: OptionAction;
  qty: number;
  strike: number; // ignored for stock
  premium: number; // entry price per share (stock entry price for stock legs)
  iv: number | null; // effective vol fraction (override already applied)
  dteYears: number; // time to expiry in years (0 for stock)
  greeks: LegGreeks | null; // live greeks per share, when available
}

export interface PayoffOptions {
  spot: number;
  r?: number;
  valuationFraction?: number; // 0 = today, 1 = expiration
  intermediateFractions?: number[];
  atmIV?: number; // vol for the win-rate distribution
  pricePoints?: number;
  rangePct?: number;
}

const MULTIPLIER = 100;
const DEFAULT_R = 0.045;
const DEFAULT_POINTS = 100;
const DEFAULT_RANGE = 0.3;

function sign(action: OptionAction): number {
  return action === "buy" ? 1 : -1;
}

// Value of one leg (per share) at underlying price S with `tYears` left.
function legValue(l: PayoffLeg, S: number, tYears: number, r: number): number {
  if (l.instrument === "stock") return S;
  if (tYears <= 0) return intrinsic(l.instrument, S, l.strike);
  const sigma = l.iv ?? 0;
  return price(l.instrument, S, l.strike, tYears, r, sigma);
}

// Position P&L (dollars) at price S, valuing each leg with `elapsedYears` of its
// life gone. Legs price at their own remaining time.
function positionPnl(
  legs: PayoffLeg[],
  S: number,
  elapsedYears: number,
  r: number,
): number {
  let pnl = 0;
  for (const l of legs) {
    const tLeft = l.instrument === "stock" ? 0 : Math.max(l.dteYears - elapsedYears, 0);
    const value = legValue(l, S, tLeft, r);
    pnl += sign(l.action) * (value - l.premium) * MULTIPLIER * l.qty;
  }
  return pnl;
}

// Expiry (terminal intrinsic) P&L at price S — each leg at its own expiration.
function expiryPnl(legs: PayoffLeg[], S: number): number {
  let pnl = 0;
  for (const l of legs) {
    const value = l.instrument === "stock" ? S : intrinsic(l.instrument, S, l.strike);
    pnl += sign(l.action) * (value - l.premium) * MULTIPLIER * l.qty;
  }
  return pnl;
}

// dP&L/dS of the expiry payoff at the extreme wings (per the piecewise-linear
// terminal payoff). Used to detect unbounded profit/loss.
function highWingSlope(legs: PayoffLeg[]): number {
  let s = 0;
  for (const l of legs) {
    const per = l.instrument === "call" ? 1 : l.instrument === "stock" ? 1 : 0;
    s += sign(l.action) * per * MULTIPLIER * l.qty;
  }
  return s;
}

// The maximum DTE across option legs — drives the slider timeline + win rate.
function maxDteYears(legs: PayoffLeg[]): number {
  return legs.reduce((m, l) => Math.max(m, l.instrument === "stock" ? 0 : l.dteYears), 0);
}

// Effective per-share greeks for a leg: prefer live greeks (when present and no
// override implied), else Black-Scholes from the effective IV.
function legGreeks(l: PayoffLeg, spot: number, r: number): LegGreeks {
  if (l.instrument === "stock") {
    return { delta: 1, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  if (l.greeks) return l.greeks;
  if (l.iv && l.dteYears > 0) {
    return greeks(l.instrument, spot, l.strike, l.dteYears, r, l.iv);
  }
  return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
}

// Sorted critical underlying prices where the terminal payoff bends: 0, each
// strike, and a far-upside point. The payoff is linear between consecutive
// points, so extrema and zero-crossings are exact at/between these.
function criticalPrices(legs: PayoffLeg[], spot: number): number[] {
  const strikes = legs
    .filter((l) => l.instrument !== "stock")
    .map((l) => l.strike);
  const far = Math.max(spot, ...strikes, 1) * 4;
  const set = new Set<number>([0, far, ...strikes]);
  return [...set].sort((a, b) => a - b);
}

function computeBreakevens(legs: PayoffLeg[], spot: number): number[] {
  const xs = criticalPrices(legs, spot);
  const breakevens: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const y0 = expiryPnl(legs, x0);
    const y1 = expiryPnl(legs, x1);
    if (y0 === 0) {
      breakevens.push(x0);
      continue;
    }
    if ((y0 < 0 && y1 > 0) || (y0 > 0 && y1 < 0)) {
      const t = y0 / (y0 - y1);
      breakevens.push(x0 + t * (x1 - x0));
    }
  }
  // De-dup near-equal crossings (a strike landing exactly on zero).
  return breakevens
    .filter((b, i, arr) => i === 0 || Math.abs(b - arr[i - 1]) > 1e-6)
    .map((b) => Number(b.toFixed(6)));
}

export function computePayoff(
  legs: PayoffLeg[],
  opts: PayoffOptions,
): PayoffResult {
  const {
    spot,
    r = DEFAULT_R,
    valuationFraction = 0,
    intermediateFractions = [0.25, 0.5, 0.75],
    pricePoints = DEFAULT_POINTS,
    rangePct = DEFAULT_RANGE,
  } = opts;

  const lo = spot * (1 - rangePct);
  const hi = spot * (1 + rangePct);
  const step = pricePoints > 1 ? (hi - lo) / (pricePoints - 1) : 0;

  const maxDte = maxDteYears(legs);
  const valElapsed = maxDte * valuationFraction;

  const points: PayoffPoint[] = [];
  for (let i = 0; i < pricePoints; i++) {
    const S = lo + step * i;
    const point: PayoffPoint = {
      price: Number(S.toFixed(4)),
      expiry: Number(expiryPnl(legs, S).toFixed(4)),
      today: Number(positionPnl(legs, S, valElapsed, r).toFixed(4)),
    };
    for (const f of intermediateFractions) {
      point[`t${f}`] = Number(positionPnl(legs, S, maxDte * f, r).toFixed(4));
    }
    points.push(point);
  }

  // Max profit / loss from the terminal payoff at critical prices, with
  // unlimited detection from the high wing (downside is always bounded since
  // S ≥ 0).
  const xs = criticalPrices(legs, spot);
  const terminalValues = xs.map((x) => expiryPnl(legs, x));
  const highSlope = highWingSlope(legs);
  const maxProfit = highSlope > 0 ? null : Math.max(...terminalValues);
  const maxLoss = highSlope < 0 ? null : Math.min(...terminalValues);

  const breakevens = computeBreakevens(legs, spot);

  // Net debit (>0 you pay) / credit (<0 you receive).
  const netDebit = legs.reduce(
    (sum, l) => sum + sign(l.action) * l.premium * MULTIPLIER * l.qty,
    0,
  );

  // Greeks.
  const perLeg: PerLegGreeks[] = legs.map((l, idx) => {
    const g = legGreeks(l, spot, r);
    const w = sign(l.action) * MULTIPLIER * l.qty;
    return {
      legId: String(idx),
      delta: g.delta * w,
      gamma: g.gamma * w,
      theta: g.theta * w,
      vega: g.vega * w,
      rho: g.rho * w,
    };
  });
  const netGreeks: NetGreeks = perLeg.reduce(
    (acc, g) => ({
      delta: acc.delta + g.delta,
      gamma: acc.gamma + g.gamma,
      theta: acc.theta + g.theta,
      vega: acc.vega + g.vega,
      rho: acc.rho + g.rho,
    }),
    { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
  );

  const winRate = computeWinRate(legs, breakevens, opts, maxDte);

  return {
    points,
    breakevens,
    maxProfit: maxProfit === null ? null : Number(maxProfit.toFixed(2)),
    maxLoss: maxLoss === null ? null : Number(maxLoss.toFixed(2)),
    netDebit: Number(netDebit.toFixed(2)),
    winRate,
    netGreeks,
    perLeg,
    priceRange: [Number(lo.toFixed(4)), Number(hi.toFixed(4))],
  };
}

// Probability that the underlying lands in a profitable zone at expiry, under a
// lognormal model: S_T = spot·exp((r − σ²/2)T + σ√T·Z). Profitable price
// intervals are the regions between breakevens where terminal P&L > 0.
function computeWinRate(
  legs: PayoffLeg[],
  breakevens: number[],
  opts: PayoffOptions,
  maxDte: number,
): number | null {
  const { spot, r = DEFAULT_R } = opts;
  // Pick a vol for the distribution: explicit atmIV, else the longest-dated
  // option leg's IV.
  const sigma =
    opts.atmIV ??
    legs.find((l) => l.instrument !== "stock" && l.iv)?.iv ??
    null;
  if (!sigma || maxDte <= 0) return null;

  // CDF of S_T ≤ p.
  const cdf = (p: number): number => {
    if (p <= 0) return 0;
    const mean = Math.log(spot) + (r - (sigma * sigma) / 2) * maxDte;
    const sd = sigma * Math.sqrt(maxDte);
    return normCdf((Math.log(p) - mean) / sd);
  };

  // Build profitable intervals from breakevens. Sample the midpoints between
  // sorted boundaries (0, ...breakevens, ∞) to test profitability.
  const bounds = [0, ...breakevens.slice().sort((a, b) => a - b), Infinity];
  let prob = 0;
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    const mid = b === Infinity ? a + spot : (a + b) / 2;
    if (expiryPnl(legs, mid) > 0) {
      const upper = b === Infinity ? 1 : cdf(b);
      prob += upper - cdf(a);
    }
  }
  return Math.min(Math.max(prob, 0), 1);
}
