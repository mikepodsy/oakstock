import { describe, it, expect } from "vitest";
import { computePayoff, type PayoffLeg } from "./payoff";

// Helper: a vanilla option leg with a 30-day life and 20% vol.
function leg(p: Partial<PayoffLeg>): PayoffLeg {
  return {
    instrument: "call",
    action: "buy",
    qty: 1,
    strike: 100,
    premium: 3,
    iv: 0.2,
    dteYears: 30 / 365,
    greeks: null,
    ...p,
  };
}

const SPOT = 100;

describe("long call", () => {
  const res = computePayoff([leg({ instrument: "call", strike: 100, premium: 3 })], {
    spot: SPOT,
  });
  it("breakeven = strike + premium", () => {
    expect(res.breakevens).toHaveLength(1);
    expect(res.breakevens[0]).toBeCloseTo(103, 4);
  });
  it("max loss = premium paid (×100)", () => {
    expect(res.maxLoss).toBeCloseTo(-300, 4);
  });
  it("max profit is unlimited", () => {
    expect(res.maxProfit).toBeNull();
  });
  it("net debit is positive (you pay)", () => {
    expect(res.netDebit).toBeCloseTo(300, 4);
  });
  it("net delta is positive", () => {
    expect(res.netGreeks.delta).toBeGreaterThan(0);
  });
});

describe("short call", () => {
  const res = computePayoff(
    [leg({ instrument: "call", action: "sell", strike: 100, premium: 3 })],
    { spot: SPOT },
  );
  it("max loss is unlimited", () => {
    expect(res.maxLoss).toBeNull();
  });
  it("max profit = premium received (×100)", () => {
    expect(res.maxProfit).toBeCloseTo(300, 4);
  });
  it("net debit is negative (you receive a credit)", () => {
    expect(res.netDebit).toBeCloseTo(-300, 4);
  });
});

describe("long put", () => {
  const res = computePayoff(
    [leg({ instrument: "put", strike: 100, premium: 4 })],
    { spot: SPOT },
  );
  it("breakeven = strike - premium", () => {
    expect(res.breakevens[0]).toBeCloseTo(96, 4);
  });
  it("max profit is bounded (downside capped at S=0)", () => {
    // (strike - premium) × 100 = 96 × 100
    expect(res.maxProfit).toBeCloseTo(9600, 4);
  });
  it("max loss = premium paid", () => {
    expect(res.maxLoss).toBeCloseTo(-400, 4);
  });
});

describe("long straddle", () => {
  const res = computePayoff(
    [
      leg({ instrument: "call", strike: 100, premium: 3 }),
      leg({ instrument: "put", strike: 100, premium: 4 }),
    ],
    { spot: SPOT },
  );
  it("has two breakevens symmetric-ish about the strike", () => {
    expect(res.breakevens).toHaveLength(2);
    const [lo, hi] = res.breakevens;
    expect(lo).toBeCloseTo(93, 4); // 100 - 7
    expect(hi).toBeCloseTo(107, 4); // 100 + 7
  });
  it("both wings are unlimited profit so maxProfit is unbounded", () => {
    expect(res.maxProfit).toBeNull();
  });
});

describe("bull call spread (buy 100, sell 105)", () => {
  const res = computePayoff(
    [
      leg({ instrument: "call", action: "buy", strike: 100, premium: 3 }),
      leg({ instrument: "call", action: "sell", strike: 105, premium: 1 }),
    ],
    { spot: SPOT },
  );
  it("net debit = 3 - 1 = 2 (×100)", () => {
    expect(res.netDebit).toBeCloseTo(200, 4);
  });
  it("max profit = spread width - net debit = (5 - 2) × 100", () => {
    expect(res.maxProfit).toBeCloseTo(300, 4);
  });
  it("max loss = net debit", () => {
    expect(res.maxLoss).toBeCloseTo(-200, 4);
  });
  it("single breakeven at 102", () => {
    expect(res.breakevens).toHaveLength(1);
    expect(res.breakevens[0]).toBeCloseTo(102, 4);
  });
});

describe("covered call (long stock + short call)", () => {
  const res = computePayoff(
    [
      { instrument: "stock", action: "buy", qty: 1, strike: 0, premium: 100, iv: null, dteYears: 0, greeks: null },
      leg({ instrument: "call", action: "sell", strike: 105, premium: 2 }),
    ],
    { spot: SPOT },
  );
  it("max profit is bounded", () => {
    // capped at (105 - 100 + 2) × 100 = 700
    expect(res.maxProfit).toBeCloseTo(700, 4);
  });
  it("max loss is bounded (stock can only fall to 0)", () => {
    expect(res.maxLoss).not.toBeNull();
  });
});

describe("valuation curve", () => {
  it("equals the expiry curve when the slider is at expiration", () => {
    const res = computePayoff(
      [leg({ instrument: "call", strike: 100, premium: 3 })],
      { spot: SPOT, valuationFraction: 1 },
    );
    for (const pt of res.points) {
      expect(pt.today).toBeCloseTo(pt.expiry, 6);
    }
  });
});

describe("win rate", () => {
  it("is a probability between 0 and 1", () => {
    const res = computePayoff(
      [leg({ instrument: "call", strike: 100, premium: 3 })],
      { spot: SPOT, atmIV: 0.3 },
    );
    expect(res.winRate).toBeGreaterThanOrEqual(0);
    expect(res.winRate).toBeLessThanOrEqual(1);
  });
});

describe("price range", () => {
  it("spans ±30% of spot with 100 points", () => {
    const res = computePayoff(
      [leg({ instrument: "call", strike: 100, premium: 3 })],
      { spot: SPOT },
    );
    expect(res.points).toHaveLength(100);
    expect(res.priceRange[0]).toBeCloseTo(70, 4);
    expect(res.priceRange[1]).toBeCloseTo(130, 4);
  });
});
