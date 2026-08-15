import { describe, it, expect } from "vitest";
import {
  DEFAULT_INDICATORS,
  addPeriod,
  isHidden,
  maColorFor,
  removePeriod,
  setIndicatorLineColor,
  setIndicatorParam,
  setPeriodColor,
  setVpRows,
  toggleHidden,
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

describe("removePeriod on the last length", () => {
  it("switches the indicator off, since an empty one draws nothing", () => {
    let s = toggleIndicator(base(), "sma");
    s = removePeriod(s, "sma", 20);
    expect(s.sma.enabled).toBe(true);

    s = removePeriod(s, "sma", 50);
    expect(s.sma.periods).toEqual([]);
    expect(s.sma.enabled).toBe(false);
  });

  it("leaves a disabled indicator disabled", () => {
    const s = removePeriod(removePeriod(base(), "sma", 20), "sma", 50);
    expect(s.sma.enabled).toBe(false);
  });
});

describe("toggleHidden / isHidden", () => {
  it("hides and unhides a key", () => {
    const hiddenOnce = toggleHidden(base(), "sma:20");
    expect(isHidden(hiddenOnce, "sma:20")).toBe(true);
    expect(isHidden(hiddenOnce, "sma:50")).toBe(false);
    expect(isHidden(toggleHidden(hiddenOnce, "sma:20"), "sma:20")).toBe(false);
  });

  it("does not mutate the input", () => {
    const s = base();
    toggleHidden(s, "rsi");
    expect(s.hidden).toEqual([]);
  });

  it("treats state persisted before `hidden` existed as nothing hidden", () => {
    const legacy = base();
    delete (legacy as Partial<IndicatorState>).hidden;
    expect(isHidden(legacy, "sma:20")).toBe(false);
    expect(toggleHidden(legacy, "sma:20").hidden).toEqual(["sma:20"]);
  });

  it("hiding is independent of enabled", () => {
    const s = toggleHidden(toggleIndicator(base(), "rsi"), "rsi");
    expect(s.rsi.enabled).toBe(true);
    expect(isHidden(s, "rsi")).toBe(true);
  });
});

describe("hidden cleanup", () => {
  it("drops the key when a length is removed, so re-adding comes back visible", () => {
    const s = toggleHidden(base(), "sma:20");
    const removed = removePeriod(s, "sma", 20);
    expect(isHidden(removed, "sma:20")).toBe(false);
  });

  it("leaves other hidden keys alone when a length is removed", () => {
    const s = toggleHidden(toggleHidden(base(), "sma:20"), "sma:50");
    expect(removePeriod(s, "sma", 20).hidden).toEqual(["sma:50"]);
  });

  it("clears every key of an indicator when it is switched off", () => {
    let s = toggleIndicator(base(), "sma");
    s = toggleHidden(toggleHidden(s, "sma:20"), "sma:50");
    s = toggleHidden(s, "rsi");

    const off = toggleIndicator(s, "sma");
    expect(off.hidden).toEqual(["rsi"]);
  });

  it("clears a single-key indicator when it is switched off", () => {
    const s = toggleHidden(toggleIndicator(base(), "bollinger"), "bollinger");
    expect(toggleIndicator(s, "bollinger").hidden).toEqual([]);
  });

  // Switching an indicator on is a request to see it, so a stale hidden key
  // (only reachable from state persisted by an older build) must not win.
  it("clears hidden keys when an indicator is switched on too", () => {
    const s = toggleHidden(base(), "rsi");
    expect(toggleIndicator(s, "rsi").hidden).toEqual([]);
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
