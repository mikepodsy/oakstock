// Analytic Black-Scholes pricing + greeks for European options.
//
// Hand-rolled (rather than the `black-scholes` npm pkg) because we also need
// greeks and the standard-normal CDF for the payoff engine's win-rate calc, and
// keeping it in one self-contained module makes the math auditable.
//
// Conventions:
//   - sigma is a fraction (0.20 = 20% vol), T in years.
//   - vega is returned per 1% vol move; theta per calendar day.
//   - greeks are per share (multiply by 100 × qty for a contract position).
import type { OptionType, LegGreeks } from "@/types/options";

// Abramowitz & Stegun 7.1.26 approximation of the error function → standard
// normal CDF. Accurate to ~1e-7, which is plenty for option pricing.
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-(x * x) / 2); // pdf(|x|)
  const poly =
    t * (0.31938153 +
      t * (-0.356563782 +
        t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const prob = 1 - d * poly;
  return x >= 0 ? prob : 1 - prob;
}

export function normPdf(x: number): number {
  return 0.3989422804014327 * Math.exp(-(x * x) / 2);
}

export function intrinsic(type: OptionType, S: number, K: number): number {
  return type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
}

// d1/d2 are undefined when T or sigma is 0; callers handle that case before
// calling this.
function d1d2(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): [number, number] {
  const d1 =
    (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return [d1, d2];
}

export function price(
  type: OptionType,
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): number {
  // At/after expiry, or zero vol → discounted intrinsic. (At T=0 there is no
  // discounting; for sigma=0 the forward is deterministic so value is the
  // discounted intrinsic of the forward, which reduces to intrinsic at the
  // common r·T≈0 case used by the chart.)
  if (T <= 0 || sigma <= 0) {
    return intrinsic(type, S, K);
  }
  const [d1, d2] = d1d2(S, K, T, r, sigma);
  const disc = K * Math.exp(-r * T);
  if (type === "call") {
    return S * normCdf(d1) - disc * normCdf(d2);
  }
  return disc * normCdf(-d2) - S * normCdf(-d1);
}

export function greeks(
  type: OptionType,
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): LegGreeks {
  if (T <= 0 || sigma <= 0) {
    // Degenerate: delta is a step at the strike, other greeks vanish.
    const itm = intrinsic(type, S, K) > 0;
    const delta = type === "call" ? (itm ? 1 : 0) : itm ? -1 : 0;
    return { delta, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  const sqrtT = Math.sqrt(T);
  const [d1, d2] = d1d2(S, K, T, r, sigma);
  const pdf = normPdf(d1);
  const disc = Math.exp(-r * T);

  const gamma = pdf / (S * sigma * sqrtT);
  const vegaFull = S * pdf * sqrtT; // per 1.00 vol
  const vega = vegaFull / 100; // per 1% vol

  if (type === "call") {
    const delta = normCdf(d1);
    const thetaAnnual =
      -(S * pdf * sigma) / (2 * sqrtT) - r * K * disc * normCdf(d2);
    const rho = (K * T * disc * normCdf(d2)) / 100;
    return { delta, gamma, theta: thetaAnnual / 365, vega, rho };
  }
  const delta = normCdf(d1) - 1;
  const thetaAnnual =
    -(S * pdf * sigma) / (2 * sqrtT) + r * K * disc * normCdf(-d2);
  const rho = (-K * T * disc * normCdf(-d2)) / 100;
  return { delta, gamma, theta: thetaAnnual / 365, vega, rho };
}
