import { describe, it, expect } from "vitest";
import type { AnalystPriceTarget, HistoricalDataPoint } from "@/types";
import { buildPriceTargetModel, type PriceTargetLayout } from "./priceTargetModel";

const LAYOUT: PriceTargetLayout = {
  padL: 6,
  padT: 18,
  plotW: 802,
  plotH: 288,
  forecastShare: 0.5,
  labelGap: 19,
};

/** `days` daily closes ending today, each at `price(i)`. */
function history(days: number, price: (i: number) => number): HistoricalDataPoint[] {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().split("T")[0],
    close: price(i),
  }));
}

const TARGET: AnalystPriceTarget = {
  mean: 421.79,
  median: 425,
  high: 475,
  low: 340,
  analystCount: 14,
};

/** Every number that ends up in an SVG attribute must be finite. */
function assertFinite(model: NonNullable<ReturnType<typeof buildPriceTargetModel>>) {
  for (const path of [model.linePath, model.areaPath, model.conePath]) {
    expect(path).not.toMatch(/NaN|Infinity/);
  }
  for (const n of [
    model.anchorX,
    model.anchorY,
    model.endX,
    model.meanY,
    model.spotY,
  ]) {
    expect(Number.isFinite(n)).toBe(true);
  }
  for (const c of model.callouts) expect(Number.isFinite(c.labelY)).toBe(true);
  for (const t of model.ticks) expect(Number.isFinite(t.x)).toBe(true);
}

describe("buildPriceTargetModel", () => {
  it("places the forecast half the history span beyond the last close", () => {
    const m = buildPriceTargetModel(history(730, (i) => 300 + i * 0.05), TARGET, 343.54, LAYOUT)!;
    // 2y of history + 1y forecast ⇒ the anchor sits two-thirds across the plot.
    const spanFraction = (m.anchorX - LAYOUT.padL) / LAYOUT.plotW;
    expect(spanFraction).toBeCloseTo(2 / 3, 2);
    expect(m.endX).toBeCloseTo(LAYOUT.padL + LAYOUT.plotW, 5);
  });

  it("labels the past and forecast spans in whole years", () => {
    const m = buildPriceTargetModel(history(730, () => 300), TARGET, 300, LAYOUT)!;
    expect(m.pastLabel).toBe("PAST 2Y");
    expect(m.horizonLabel).toBe("1Y FORECAST");
  });

  it("falls back to months for a short history", () => {
    const m = buildPriceTargetModel(history(120, () => 300), TARGET, 300, LAYOUT)!;
    expect(m.pastLabel).toBe("PAST 4M");
    expect(m.horizonLabel).toBe("2M FORECAST");
  });

  it("puts a higher price higher on the chart", () => {
    const m = buildPriceTargetModel(history(730, () => 300), TARGET, 343.54, LAYOUT)!;
    const high = m.callouts.find((c) => c.key === "high")!;
    const low = m.callouts.find((c) => c.key === "low")!;
    // SVG y grows downward, so the high target must have the smaller y.
    expect(m.meanY).toBeLessThan(m.spotY);
    expect(high.value).toBeGreaterThan(low.value);
  });

  it("reports each target as a percentage move from spot", () => {
    const m = buildPriceTargetModel(
      history(730, () => 100),
      { mean: 120, median: 120, high: 150, low: 90, analystCount: 5 },
      100,
      LAYOUT
    )!;
    const byKey = Object.fromEntries(m.callouts.map((c) => [c.key, c]));
    expect(byKey.high.text).toBe("+50.0%");
    expect(byKey.mean.text).toBe("+20.0%");
    expect(byKey.low.text).toBe("−10.0%");
    expect(byKey.low.positive).toBe(false);
    expect(byKey.spot.text).toBe("Current");
  });

  it("keeps every callout inside the plot and clear of its neighbours", () => {
    // Targets bunched within a percent of spot would otherwise stack up.
    const m = buildPriceTargetModel(
      history(730, () => 100),
      { mean: 100.5, median: 100.5, high: 101, low: 99.5, analystCount: 5 },
      100,
      LAYOUT
    )!;
    const ys = m.callouts.map((c) => c.labelY).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(LAYOUT.labelGap - 1e-9);
    }
    expect(ys[0]).toBeGreaterThanOrEqual(LAYOUT.padT + 8);
    expect(ys[ys.length - 1]).toBeLessThanOrEqual(
      LAYOUT.padT + LAYOUT.plotH - 8
    );
  });

  it("uses the last close when there is no live price", () => {
    const m = buildPriceTargetModel(history(730, () => 250), TARGET, null, LAYOUT)!;
    expect(m.callouts.find((c) => c.key === "spot")!.value).toBe(250);
  });

  describe("degenerate inputs", () => {
    it("returns null rather than a broken chart for fewer than two points", () => {
      expect(buildPriceTargetModel([], TARGET, 100, LAYOUT)).toBeNull();
      expect(buildPriceTargetModel(history(1, () => 100), TARGET, 100, LAYOUT)).toBeNull();
    });

    it("returns null when every point shares one timestamp", () => {
      // Would collapse the x-scale and put Infinity into every coordinate.
      const sameDay: HistoricalDataPoint[] = [
        { date: "2025-01-01", close: 100 },
        { date: "2025-01-01", close: 101 },
      ];
      expect(buildPriceTargetModel(sameDay, TARGET, 100, LAYOUT)).toBeNull();
    });

    it("survives a perfectly flat series, which has no range to pad", () => {
      const m = buildPriceTargetModel(
        history(730, () => 100),
        { mean: 100, median: 100, high: 100, low: 100, analystCount: 1 },
        100,
        LAYOUT
      );
      expect(m).not.toBeNull();
      assertFinite(m!);
    });

    it("survives a zero-priced series", () => {
      const m = buildPriceTargetModel(
        history(730, () => 0),
        { mean: 0, median: 0, high: 0, low: 0, analystCount: 1 },
        0,
        LAYOUT
      );
      expect(m).not.toBeNull();
      assertFinite(m!);
    });

    it("skips points with a non-numeric close", () => {
      const dirty = [
        ...history(3, () => 100),
        { date: "not-a-date", close: 100 },
        { date: "2026-01-01", close: NaN },
      ] as HistoricalDataPoint[];
      const m = buildPriceTargetModel(dirty, TARGET, 100, LAYOUT);
      expect(m).not.toBeNull();
      assertFinite(m!);
    });

    it("produces finite geometry on live-shaped input", () => {
      const m = buildPriceTargetModel(
        history(730, (i) => 250 + Math.sin(i / 30) * 40 + i * 0.1),
        TARGET,
        343.54,
        LAYOUT
      );
      expect(m).not.toBeNull();
      assertFinite(m!);
    });
  });
});
