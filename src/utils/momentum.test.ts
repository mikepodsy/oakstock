import { describe, it, expect } from "vitest";
import { crossState, evaluateMomentum } from "./momentum";
import type { QuestradeCandle } from "@/types";

// Build a synthetic daily candle series from a list of closes (oldest → newest).
// OHLC are set to the close; only `close` matters for moving-average math.
function candlesFromCloses(closes: number[]): QuestradeCandle[] {
  const dayMs = 86_400_000;
  const t0 = Date.parse("2020-01-01T00:00:00.000Z");
  return closes.map((close, i) => ({
    time: new Date(t0 + i * dayMs).toISOString(),
    open: close,
    high: close,
    low: close,
    close,
    volume: 0,
  }));
}

describe("crossState", () => {
  it("flags a cross UP on the latest bar (a moves above b)", () => {
    // a ends above b, and was below b on the previous bar.
    const a = [1, 2, 3, 9];
    const b = [5, 5, 5, 5];
    const s = crossState(a, b);
    expect(s.relation).toBe("above");
    expect(s.crossedThisBar).toBe(true);
    expect(s.direction).toBe("up");
    expect(s.sessionsSinceCross).toBe(0);
  });

  it("flags a cross DOWN on the latest bar (a moves below b)", () => {
    const a = [9, 8, 7, 1];
    const b = [5, 5, 5, 5];
    const s = crossState(a, b);
    expect(s.relation).toBe("below");
    expect(s.crossedThisBar).toBe(true);
    expect(s.direction).toBe("down");
    expect(s.sessionsSinceCross).toBe(0);
  });

  it("does not flag a fresh cross when the relationship is unchanged", () => {
    const a = [6, 7, 8, 9];
    const b = [5, 5, 5, 5];
    const s = crossState(a, b);
    expect(s.relation).toBe("above");
    expect(s.crossedThisBar).toBe(false);
    expect(s.direction).toBe(null);
  });

  it("reports how many sessions ago the last cross happened", () => {
    // crosses above b at index 1, then stays above → 2 sessions since the cross
    // (latest index 3, cross at index 1).
    const a = [1, 9, 9, 9];
    const b = [5, 5, 5, 5];
    const s = crossState(a, b);
    expect(s.crossedThisBar).toBe(false);
    expect(s.sessionsSinceCross).toBe(2);
  });

  it("returns null sessionsSinceCross when no cross exists in the window", () => {
    const a = [6, 7, 8, 9];
    const b = [5, 5, 5, 5];
    expect(crossState(a, b).sessionsSinceCross).toBe(null);
  });
});

describe("evaluateMomentum", () => {
  it("computes the latest 50d/200d MAs and price relation for a long series", () => {
    // 220 ascending closes → price is above both rising MAs.
    const closes = Array.from({ length: 220 }, (_, i) => 100 + i);
    const status = evaluateMomentum("TEST", candlesFromCloses(closes));

    expect(status.ticker).toBe("TEST");
    expect(status.close).toBe(closes[closes.length - 1]);
    expect(status.sma50).not.toBeNull();
    expect(status.sma200).not.toBeNull();
    // On a strictly rising series the latest close sits above both MAs.
    expect(status.priceVs50.relation).toBe("above");
    expect(status.priceVs200.relation).toBe("above");
    expect(status.distance50Pct).toBeGreaterThan(0);
  });

  it("handles a short series (<200 bars) with sma200 null and no throw", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    const status = evaluateMomentum("SHORT", candlesFromCloses(closes));

    expect(status.sma50).not.toBeNull();
    expect(status.sma200).toBeNull();
    // The 200d-dependent signals degrade gracefully rather than throwing.
    expect(status.priceVs200.crossedThisBar).toBe(false);
    expect(status.cross50v200.crossedThisBar).toBe(false);
  });
});
