import { describe, it, expect } from "vitest";
import {
  DEFAULT_INDICATORS,
  addPeriod,
  maColorFor,
  removePeriod,
  setIndicatorLineColor,
  setIndicatorParam,
  setPeriodColor,
  setVpRows,
  toggleIndicator,
  toggleVpValueArea,
  type IndicatorState,
} from "./indicatorConfig";

// A fresh deep-ish clone so a reducer mutating shared state fails loudly here
// rather than leaking between cases.
const base = (): IndicatorState => structuredClone(DEFAULT_INDICATORS);

describe("toggleIndicator", () => {
  it("flips only the targeted indicator", () => {
    const next = toggleIndicator(base(), "sma");
    expect(next.sma.enabled).toBe(true);
    expect(next.ema.enabled).toBe(false);
    expect(next.volume.enabled).toBe(true);
  });

  it("does not mutate the input", () => {
    const s = base();
    toggleIndicator(s, "sma");
    expect(s.sma.enabled).toBe(false);
  });
});

describe("addPeriod", () => {
  it("inserts and keeps the list sorted", () => {
    expect(addPeriod(base(), "sma", 9).sma.periods).toEqual([9, 20, 50]);
    expect(addPeriod(base(), "sma", 200).sma.periods).toEqual([20, 50, 200]);
  });

  it("rejects duplicates", () => {
    const s = base();
    expect(addPeriod(s, "sma", 20)).toBe(s);
  });

  it("rejects sub-1 and non-finite lengths so raw menu input can pass through", () => {
    const s = base();
    expect(addPeriod(s, "sma", 0)).toBe(s);
    expect(addPeriod(s, "sma", -5)).toBe(s);
    expect(addPeriod(s, "sma", NaN)).toBe(s);
    expect(addPeriod(s, "sma", Infinity)).toBe(s);
  });
});

describe("removePeriod", () => {
  it("removes the length", () => {
    expect(removePeriod(base(), "sma", 20).sma.periods).toEqual([50]);
  });

  it("drops the length's custom color so re-adding falls back to the palette", () => {
    const withColor = setPeriodColor(base(), "sma", 20, "#ff0000");
    expect(withColor.sma.colors[20]).toBe("#ff0000");

    const removed = removePeriod(withColor, "sma", 20);
    expect(removed.sma.colors[20]).toBeUndefined();

    const readded = addPeriod(removed, "sma", 20);
    // No override left, so it resolves to the auto-cycled palette color.
    expect(maColorFor(readded.sma.colors, 20, 0)).not.toBe("#ff0000");
  });
});

describe("setIndicatorParam / setIndicatorLineColor", () => {
  it("sets a numeric param without touching siblings", () => {
    const next = setIndicatorParam(base(), "bollinger", "mult", 2.5);
    expect(next.bollinger.mult).toBe(2.5);
    expect(next.bollinger.period).toBe(DEFAULT_INDICATORS.bollinger.period);
  });

  it("sets a single-line indicator color", () => {
    expect(setIndicatorLineColor(base(), "rsi", "#123456").rsi.color).toBe("#123456");
  });
});

describe("volume profile", () => {
  it("accepts a valid row count", () => {
    expect(setVpRows(base(), 120).volumeProfile.rows).toBe(120);
  });

  it("rejects sub-1 and non-finite row counts", () => {
    const s = base();
    expect(setVpRows(s, 0)).toBe(s);
    expect(setVpRows(s, NaN)).toBe(s);
  });

  it("toggles the value area", () => {
    const s = base();
    expect(toggleVpValueArea(s).volumeProfile.showValueArea).toBe(
      !s.volumeProfile.showValueArea
    );
  });
});
