import { describe, it, expect } from "vitest";
import {
  adx,
  awesomeOscillator,
  bullBearPower,
  cci,
  hullMa,
  ichimokuBaseLine,
  macd,
  momentum,
  stochRsi,
  stochastic,
  ultimateOscillator,
  vwma,
  williamsR,
} from "./technicalIndicators";
import type { QuestradeCandle } from "@/types";

// Bars are one day apart starting 2026-01-01; only the OHLCV matters to the
// math, so the timestamps just have to be distinct and ordered.
function bar(
  i: number,
  o: number,
  h: number,
  l: number,
  c: number,
  v = 100
): QuestradeCandle {
  const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
  return { time: day, open: o, high: h, low: l, close: c, volume: v };
}

/** `n` bars whose OHLC are all `price`. */
function flat(n: number, price: number, volume = 100): QuestradeCandle[] {
  return Array.from({ length: n }, (_, i) =>
    bar(i, price, price, price, price, volume)
  );
}

/** Closes 1, 2, 3 … n — a unit-slope ramp, flat OHLC. */
function ramp(n: number): QuestradeCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const p = i + 1;
    return bar(i, p, p, p, p);
  });
}

const last = (points: { value: number }[]) => points[points.length - 1].value;

describe("momentum", () => {
  it("is the change over the lookback, not the change per bar", () => {
    // Closes 1..5, period 2 → every point is +2, and the first two bars have no
    // prior bar to compare against.
    const out = momentum(ramp(5), 2);
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.value)).toEqual([2, 2, 2]);
  });
});

describe("williamsR", () => {
  it("reads -100 when the close sits at the low of the range", () => {
    const out = williamsR([bar(0, 5, 10, 0, 10), bar(1, 5, 10, 0, 0)], 2);
    expect(last(out)).toBe(-100);
  });

  it("reads 0 when the close sits at the high of the range", () => {
    const out = williamsR([bar(0, 5, 10, 0, 0), bar(1, 5, 10, 0, 10)], 2);
    expect(last(out)).toBe(0);
  });

  it("returns the midpoint rather than dividing by zero on a flat range", () => {
    expect(last(williamsR(flat(3, 100), 2))).toBe(-50);
  });
});

describe("cci", () => {
  it("scales the deviation from the typical-price average by 0.015", () => {
    // Typical prices 10, 20, 30 (flat OHLC). SMA = 20, mean deviation = 20/3.
    // CCI = (30 - 20) / (0.015 * 20/3) = 100 exactly.
    const candles = [bar(0, 10, 10, 10, 10), bar(1, 20, 20, 20, 20), bar(2, 30, 30, 30, 30)];
    expect(last(cci(candles, 3))).toBeCloseTo(100, 10);
  });

  it("is zero when there is no deviation to scale", () => {
    expect(last(cci(flat(5, 42), 3))).toBe(0);
  });
});

describe("stochastic", () => {
  it("places the close within the high-low range", () => {
    // Range 0–10 across the window, close at 5 → 50%. kSmooth 1 keeps %K raw.
    const candles = [
      bar(0, 5, 10, 0, 10),
      bar(1, 5, 10, 0, 0),
      bar(2, 5, 10, 0, 5),
    ];
    const { k } = stochastic(candles, 3, 1, 1);
    expect(last(k)).toBe(50);
  });

  it("smooths %K and then %D by the requested periods", () => {
    const candles = [
      bar(0, 5, 10, 0, 0), // raw %K   0
      bar(1, 5, 10, 0, 10), // raw %K 100
      bar(2, 5, 10, 0, 5), // raw %K  50
    ];
    // %K(3-smoothed) over the only full window = (0 + 100 + 50) / 3 = 50.
    const { k, d } = stochastic(candles, 1, 3, 1);
    expect(last(k)).toBeCloseTo(50, 10);
    expect(last(d)).toBeCloseTo(50, 10);
  });

  it("returns the midpoint rather than dividing by zero on a flat range", () => {
    const { k } = stochastic(flat(5, 100), 3, 1, 1);
    expect(last(k)).toBe(50);
  });
});

describe("stochRsi", () => {
  it("stays within 0–100", () => {
    // A ramp pins RSI at 100, which leaves no range to scale — the midpoint
    // guard applies rather than a divide-by-zero.
    const { k } = stochRsi(ramp(60), 14, 14, 3, 3);
    expect(last(k)).toBeGreaterThanOrEqual(0);
    expect(last(k)).toBeLessThanOrEqual(100);
  });

  it("reads high when RSI is at the top of its recent range", () => {
    // Down for 30 bars, then up for 30: RSI ends at the top of its window.
    const candles = [
      ...Array.from({ length: 30 }, (_, i) => bar(i, 100 - i, 100 - i, 100 - i, 100 - i)),
      ...Array.from({ length: 30 }, (_, i) =>
        bar(30 + i, 70 + i, 70 + i, 70 + i, 70 + i)
      ),
    ];
    const { k } = stochRsi(candles, 14, 14, 3, 3);
    expect(last(k)).toBeGreaterThan(80);
  });
});

describe("macd", () => {
  it("is the fast EMA minus the slow EMA, with the signal trailing it", () => {
    // Compounding growth, so the spread between the two EMAs keeps widening and
    // the signal line genuinely trails. (On a straight ramp MACD converges to a
    // constant and the two lines sit on top of each other.)
    const compounding = Array.from({ length: 60 }, (_, i) => {
      const p = 100 * 1.02 ** i;
      return bar(i, p, p, p, p);
    });
    const { macd: line, signal } = macd(compounding, 12, 26, 9);
    expect(last(line)).toBeGreaterThan(0);
    expect(last(line)).toBeGreaterThan(last(signal));
  });

  it("collapses to zero on a flat series", () => {
    const { macd: line, signal } = macd(flat(60, 50), 12, 26, 9);
    expect(last(line)).toBeCloseTo(0, 10);
    expect(last(signal)).toBeCloseTo(0, 10);
  });
});

describe("adx", () => {
  it("marks a clean uptrend as directional with +DI on top", () => {
    const up = Array.from({ length: 60 }, (_, i) =>
      bar(i, 100 + i, 101 + i, 99 + i, 100.5 + i)
    );
    const { adx: a, plusDi, minusDi } = adx(up, 14);
    expect(last(a)).toBeGreaterThan(20);
    expect(last(plusDi)).toBeGreaterThan(last(minusDi));
  });

  it("flips -DI on top in a downtrend", () => {
    const down = Array.from({ length: 60 }, (_, i) =>
      bar(i, 200 - i, 201 - i, 199 - i, 199.5 - i)
    );
    const { plusDi, minusDi } = adx(down, 14);
    expect(last(minusDi)).toBeGreaterThan(last(plusDi));
  });
});

describe("awesomeOscillator", () => {
  it("measures the 5-bar median against the 34-bar median", () => {
    // 33 bars at 100 then one at 200: SMA5 = 120, SMA34 = 3500/34.
    const candles = [...flat(33, 100), bar(33, 200, 200, 200, 200)];
    expect(last(awesomeOscillator(candles))).toBeCloseTo(120 - 3500 / 34, 8);
  });
});

describe("bullBearPower", () => {
  it("sums the high and low distances from the 13-bar EMA", () => {
    // Flat closes → EMA13 = 100, so BBP = (110 - 100) + (90 - 100) = 0.
    const candles = [...flat(20, 100), bar(20, 100, 110, 90, 100)];
    expect(last(bullBearPower(candles, 13))).toBeCloseTo(0, 8);
  });

  it("goes positive when the bar straddles the average to the upside", () => {
    const candles = [...flat(20, 100), bar(20, 100, 130, 95, 100)];
    expect(last(bullBearPower(candles, 13))).toBeCloseTo(25, 8);
  });
});

describe("ultimateOscillator", () => {
  it("pins at 100 when every bar's buying pressure fills its true range", () => {
    // close == high and each high above the prior close, so BP == TR on every
    // bar and all three averages are 1: 100 * (4 + 2 + 1) / 7 = 100.
    const candles = Array.from({ length: 40 }, (_, i) =>
      bar(i, 100 + i, 101 + i, 100 + i, 101 + i)
    );
    expect(last(ultimateOscillator(candles, 7, 14, 28))).toBeCloseTo(100, 8);
  });
});

describe("ichimokuBaseLine", () => {
  it("is the midpoint of the 26-bar high and low", () => {
    const candles = Array.from({ length: 30 }, (_, i) =>
      bar(i, 50, i === 5 ? 200 : 60, i === 6 ? 10 : 40, 50)
    );
    // Bars 4..29 are the last 26: the 200 high and the 10 low both fall inside.
    expect(last(ichimokuBaseLine(candles, 26))).toBe(105);
  });
});

describe("vwma", () => {
  it("weights closes by volume rather than averaging them", () => {
    // 10 @ 1 share, 20 @ 3 shares → 17.5, not the 15 a plain mean gives.
    const candles = [bar(0, 10, 10, 10, 10, 1), bar(1, 20, 20, 20, 20, 3)];
    expect(last(vwma(candles, 2))).toBe(17.5);
  });

  it("falls back to the simple average when the window has no volume", () => {
    const candles = [bar(0, 10, 10, 10, 10, 0), bar(1, 20, 20, 20, 20, 0)];
    expect(last(vwma(candles, 2))).toBe(15);
  });
});

describe("hullMa", () => {
  it("tracks a linear ramp with no lag", () => {
    // The whole point of the Hull average: on a constant-slope series it lands
    // exactly on the current value instead of trailing it.
    expect(last(hullMa(ramp(30), 9))).toBeCloseTo(30, 8);
  });
});
