import { describe, it, expect } from "vitest";
import { price, greeks, normCdf, intrinsic } from "./blackScholes";

// Textbook reference case: S=100, K=100, T=1, r=0.05, sigma=0.20.
// Standard Black-Scholes results (widely published):
//   call ≈ 10.4506, put ≈ 5.5735, call delta ≈ 0.6368, vega ≈ 37.52 (per 1.00 vol),
//   call theta ≈ -6.414/yr, gamma ≈ 0.0188.
const S = 100;
const K = 100;
const T = 1;
const r = 0.05;
const sigma = 0.2;

describe("normCdf", () => {
  it("is 0.5 at zero", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
  });
  it("matches a known value at 1", () => {
    expect(normCdf(1)).toBeCloseTo(0.8413447, 5);
  });
  it("is symmetric", () => {
    expect(normCdf(-1.5) + normCdf(1.5)).toBeCloseTo(1, 6);
  });
});

describe("price", () => {
  it("prices an ATM call (textbook value)", () => {
    expect(price("call", S, K, T, r, sigma)).toBeCloseTo(10.4506, 3);
  });
  it("prices an ATM put (textbook value)", () => {
    expect(price("put", S, K, T, r, sigma)).toBeCloseTo(5.5735, 3);
  });
  it("satisfies put-call parity: C - P = S - K*e^{-rT}", () => {
    const c = price("call", S, K, T, r, sigma);
    const p = price("put", S, K, T, r, sigma);
    expect(c - p).toBeCloseTo(S - K * Math.exp(-r * T), 6);
  });
  it("returns intrinsic value at expiry (T=0)", () => {
    expect(price("call", 110, 100, 0, r, sigma)).toBeCloseTo(10, 6);
    expect(price("put", 110, 100, 0, r, sigma)).toBeCloseTo(0, 6);
  });
  it("returns intrinsic value when sigma=0", () => {
    expect(price("call", 110, 100, 1, 0, 0)).toBeCloseTo(10, 6);
  });
});

describe("greeks", () => {
  it("computes call delta (textbook value)", () => {
    expect(greeks("call", S, K, T, r, sigma).delta).toBeCloseTo(0.6368, 3);
  });
  it("put delta = call delta - 1", () => {
    const cd = greeks("call", S, K, T, r, sigma).delta;
    const pd = greeks("put", S, K, T, r, sigma).delta;
    expect(pd).toBeCloseTo(cd - 1, 4);
  });
  it("gamma is equal for calls and puts and matches textbook", () => {
    const cg = greeks("call", S, K, T, r, sigma).gamma;
    const pg = greeks("put", S, K, T, r, sigma).gamma;
    expect(cg).toBeCloseTo(pg, 8);
    expect(cg).toBeCloseTo(0.018762, 4);
  });
  it("vega is per 1% vol move and equal for calls/puts", () => {
    // Full vega ≈ 37.52 per 1.00 vol → ~0.3752 per 1% vol.
    const v = greeks("call", S, K, T, r, sigma).vega;
    expect(v).toBeCloseTo(0.3752, 3);
    expect(greeks("put", S, K, T, r, sigma).vega).toBeCloseTo(v, 8);
  });
  it("theta is per day and negative for a long call", () => {
    // Annual call theta ≈ -6.414 → per day ≈ -0.01757.
    expect(greeks("call", S, K, T, r, sigma).theta).toBeCloseTo(-0.01757, 4);
  });
});

describe("intrinsic", () => {
  it("call intrinsic is max(S-K, 0)", () => {
    expect(intrinsic("call", 110, 100)).toBe(10);
    expect(intrinsic("call", 90, 100)).toBe(0);
  });
  it("put intrinsic is max(K-S, 0)", () => {
    expect(intrinsic("put", 90, 100)).toBe(10);
    expect(intrinsic("put", 110, 100)).toBe(0);
  });
});
