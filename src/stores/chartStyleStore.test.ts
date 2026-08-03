import { describe, it, expect } from "vitest";
import {
  DEFAULT_CHART_STYLE,
  resetStyle,
  setBackground,
  setBarColor,
  setColor,
  setLineColor,
  setOpacity,
  toggleVisible,
  withAlpha,
  type ChartStyleState,
} from "./chartStyleStore";

const base = (): ChartStyleState => structuredClone(DEFAULT_CHART_STYLE);

describe("setColor", () => {
  it("sets one side of one group and leaves the other side alone", () => {
    const next = setColor(base(), "body", "up", "#00ff00");
    expect(next.body.up).toBe("#00ff00");
    expect(next.body.down).toBe(DEFAULT_CHART_STYLE.body.down);
    expect(next.wick).toEqual(DEFAULT_CHART_STYLE.wick);
  });

  it("preserves the group's visibility flag", () => {
    const hidden = toggleVisible(base(), "border");
    expect(hidden.border.visible).toBe(false);
    expect(setColor(hidden, "border", "up", "#abcdef").border.visible).toBe(false);
  });

  it("does not mutate the input", () => {
    const s = base();
    setColor(s, "body", "up", "#00ff00");
    expect(s.body.up).toBe(DEFAULT_CHART_STYLE.body.up);
  });
});

describe("setBarColor / setLineColor / setBackground", () => {
  it("keeps bar colors independent of the candle body", () => {
    const next = setBarColor(base(), "up", "#111111");
    expect(next.bar.up).toBe("#111111");
    expect(next.body.up).toBe(DEFAULT_CHART_STYLE.body.up);
  });

  it("sets the line and background colors", () => {
    expect(setLineColor(base(), "#222222").line).toBe("#222222");
    expect(setBackground(base(), "#333333").background).toBe("#333333");
  });
});

describe("setOpacity", () => {
  it("clamps to 0..1", () => {
    expect(setOpacity(base(), "candleUpOpacity", 2).candleUpOpacity).toBe(1);
    expect(setOpacity(base(), "candleUpOpacity", -1).candleUpOpacity).toBe(0);
    expect(setOpacity(base(), "backgroundOpacity", 0.35).backgroundOpacity).toBe(0.35);
  });

  it("targets only the named opacity", () => {
    const next = setOpacity(base(), "candleDownOpacity", 0.5);
    expect(next.candleDownOpacity).toBe(0.5);
    expect(next.candleUpOpacity).toBe(DEFAULT_CHART_STYLE.candleUpOpacity);
  });
});

describe("resetStyle", () => {
  it("returns the defaults as a fresh object, not the shared constant", () => {
    const r = resetStyle();
    expect(r).toEqual(DEFAULT_CHART_STYLE);
    expect(r).not.toBe(DEFAULT_CHART_STYLE);
  });
});

describe("withAlpha", () => {
  it("converts hex + alpha to rgba for lightweight-charts", () => {
    expect(withAlpha("#22C55E", 1)).toBe("rgba(34, 197, 94, 1)");
    expect(withAlpha("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("clamps alpha and passes unparseable input through untouched", () => {
    expect(withAlpha("#22C55E", 5)).toBe("rgba(34, 197, 94, 1)");
    expect(withAlpha("not-a-hex", 1)).toBe("not-a-hex");
  });
});
