import { describe, it, expect } from "vitest";
import { vwap } from "./indicators";
import type { QuestradeCandle } from "@/types";

// Flat OHLC so the typical price (H+L+C)/3 equals `price` exactly, keeping the
// expected values hand-checkable.
function candle(time: string, price: number, volume: number): QuestradeCandle {
  return { time, open: price, high: price, low: price, close: price, volume };
}

describe("vwap (session-anchored)", () => {
  it("weights by volume rather than averaging price", () => {
    // Two bars in one session: 100 @ 100sh, 200 @ 300sh.
    // VWAP = (100*100 + 200*300) / 400 = 175 — not the 150 a plain mean gives.
    const out = vwap(
      [
        candle("2026-06-01T14:00:00Z", 100, 100),
        candle("2026-06-01T14:01:00Z", 200, 300),
      ],
      "session"
    );
    expect(out).toHaveLength(2);
    expect(out[0].value).toBe(100);
    expect(out[1].value).toBe(175);
  });

  it("resets at each new US Eastern trading day", () => {
    // 2026-06-01 14:30Z = 10:30 ET, 2026-06-02 14:30Z = 10:30 ET the next day.
    const out = vwap(
      [
        candle("2026-06-01T14:30:00Z", 100, 100),
        candle("2026-06-01T15:30:00Z", 300, 100),
        candle("2026-06-02T14:30:00Z", 50, 100),
      ],
      "session"
    );
    expect(out[1].value).toBe(200); // still day one: (100+300)/2
    // Day two starts fresh — a running VWAP would sit near 150 here.
    expect(out[2].value).toBe(50);
  });

  it("does not reset at UTC midnight mid-session", () => {
    // 2026-06-01 23:00Z and 2026-06-02 00:00Z are both 2026-06-01 ET
    // (19:00 and 20:00 ET), so they belong to the same trading day.
    const out = vwap(
      [
        candle("2026-06-01T23:00:00Z", 100, 100),
        candle("2026-06-02T00:00:00Z", 300, 100),
      ],
      "session"
    );
    expect(out[1].value).toBe(200);
  });

  it("skips zero-volume bars instead of dividing by zero", () => {
    const out = vwap(
      [
        candle("2026-06-01T14:00:00Z", 100, 0),
        candle("2026-06-01T14:01:00Z", 200, 100),
      ],
      "session"
    );
    // First bar contributes no volume, so no point is emitted for it.
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(200);
  });

  it("returns nothing when the whole series has no volume", () => {
    const out = vwap(
      [candle("2026-06-01T14:00:00Z", 100, 0), candle("2026-06-01T14:01:00Z", 200, 0)],
      "session"
    );
    expect(out).toEqual([]);
  });

  it("uses the typical price (H+L+C)/3, not the close", () => {
    const out = vwap(
      [{ time: "2026-06-01T14:00:00Z", open: 10, high: 120, low: 60, close: 90, volume: 10 }],
      "session"
    );
    expect(out[0].value).toBe(90); // (120+60+90)/3
  });
});

describe("vwap (rolling)", () => {
  it("emits only once the window is full and then drops the oldest bar", () => {
    const candles = [
      candle("2026-06-01T14:00:00Z", 100, 100),
      candle("2026-06-01T14:01:00Z", 200, 100),
      candle("2026-06-01T14:02:00Z", 300, 100),
    ];
    const out = vwap(candles, "rolling", 2);
    expect(out).toHaveLength(2);
    expect(out[0].value).toBe(150); // bars 1-2
    expect(out[1].value).toBe(250); // bars 2-3, bar 1 evicted
  });

  it("spans trading days, unlike the session anchor", () => {
    const out = vwap(
      [
        candle("2026-06-01T14:30:00Z", 100, 100),
        candle("2026-06-02T14:30:00Z", 300, 100),
      ],
      "rolling",
      2
    );
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(200);
  });

  it("rejects a sub-1 period", () => {
    expect(vwap([candle("2026-06-01T14:00:00Z", 100, 100)], "rolling", 0)).toEqual([]);
  });
});
