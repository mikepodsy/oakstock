import { describe, it, expect } from "vitest";
import { computeVolumeProfile } from "./volumeProfile";
import type { QuestradeCandle } from "@/types";

// Candle factory — `time` is unused by the profile math, so it's a fixed stub.
function candle(
  low: number,
  high: number,
  open: number,
  close: number,
  volume: number
): QuestradeCandle {
  return { time: "2026-01-01T00:00:00Z", open, high, low, close, volume };
}

describe("computeVolumeProfile", () => {
  it("spreads a candle's volume evenly across the bins it spans", () => {
    // One up candle covering the full 0..10 range, 10 rows → 10 equal bins.
    const p = computeVolumeProfile([candle(0, 10, 1, 2, 100)], 10);
    expect(p).not.toBeNull();
    expect(p!.bins).toHaveLength(10);
    expect(p!.bins[0].low).toBeCloseTo(0);
    expect(p!.bins[0].high).toBeCloseTo(1);
    expect(p!.bins[9].high).toBeCloseTo(10);
    expect(p!.totalVolume).toBe(100);
    for (const b of p!.bins) {
      expect(b.total).toBeCloseTo(10);
      expect(b.up).toBeCloseTo(10); // up candle → all volume is "up"
      expect(b.down).toBeCloseTo(0);
    }
  });

  it("splits volume into up/down by candle direction", () => {
    const up = candle(0, 10, 1, 2, 100); // close >= open
    const down = candle(0, 10, 2, 1, 60); // close < open
    const p = computeVolumeProfile([up, down], 10)!;
    const upSum = p.bins.reduce((s, b) => s + b.up, 0);
    const downSum = p.bins.reduce((s, b) => s + b.down, 0);
    expect(upSum).toBeCloseTo(100);
    expect(downSum).toBeCloseTo(60);
    expect(p.totalVolume).toBe(160);
  });

  it("picks the Point of Control at the highest-volume price bin", () => {
    // Zero-volume boundary candles fix the range to [0, 10] without adding
    // volume; the loaded candle concentrates volume in bin 5 (5..6).
    const candles = [
      candle(0, 0, 0, 0, 0),
      candle(10, 10, 10, 10, 0),
      candle(5.1, 5.9, 5.1, 5.9, 1000),
    ];
    const p = computeVolumeProfile(candles, 10)!;
    expect(p.poc).toBeCloseTo(5.5); // mid of bin 5
    expect(p.maxBinTotal).toBeCloseTo(1000);
  });

  it("encloses ~70% of volume in the value area around the POC", () => {
    const candles = [
      candle(0, 0, 0, 0, 0), // fix range low
      candle(10, 10, 10, 10, 0), // fix range high
      candle(3.1, 3.9, 3.1, 3.9, 10),
      candle(4.1, 4.9, 4.1, 4.9, 20),
      candle(5.1, 5.9, 5.1, 5.9, 40), // POC bin
      candle(6.1, 6.9, 6.1, 6.9, 20),
      candle(7.1, 7.9, 7.1, 7.9, 10),
    ];
    const p = computeVolumeProfile(candles, 10)!;
    expect(p.totalVolume).toBe(100);
    expect(p.poc).toBeCloseTo(5.5);
    // Value area grows symmetrically to bins 4–6 → [4, 7], covering 80% (>= 70%).
    expect(p.val).toBeCloseTo(4);
    expect(p.vah).toBeCloseTo(7);
  });

  it("returns null for empty input, a flat range, or zero volume", () => {
    expect(computeVolumeProfile([], 10)).toBeNull();
    expect(computeVolumeProfile([candle(5, 5, 5, 5, 100)], 10)).toBeNull();
    expect(computeVolumeProfile([candle(0, 10, 1, 2, 0)], 10)).toBeNull();
  });
});
