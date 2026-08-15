import { describe, it, expect } from "vitest";
import { buildLegendRows } from "./chartLegend";
import {
  DEFAULT_INDICATORS,
  maColor,
  toggleHidden,
  toggleIndicator,
  type IndicatorId,
  type IndicatorState,
} from "./indicatorConfig";

const base = (): IndicatorState => structuredClone(DEFAULT_INDICATORS);

// Volume is on by default; most cases here care about one indicator at a time.
const only = (...ids: IndicatorId[]): IndicatorState => {
  let s = toggleIndicator(base(), "volume");
  for (const id of ids) s = toggleIndicator(s, id);
  return s;
};

describe("buildLegendRows", () => {
  it("emits nothing when every indicator is off", () => {
    expect(buildLegendRows(only())).toEqual([]);
  });

  it("expands SMA and EMA to one row per length", () => {
    const rows = buildLegendRows(only("sma", "ema"));
    expect(rows.map((r) => r.label)).toEqual([
      "SMA 20",
      "SMA 50",
      "EMA 12",
      "EMA 26",
    ]);
    expect(rows.map((r) => r.key)).toEqual([
      "sma:20",
      "sma:50",
      "ema:12",
      "ema:26",
    ]);
    // Each row carries the length so the row's × can remove just that line.
    expect(rows.map((r) => r.period)).toEqual([20, 50, 12, 26]);
  });

  it("draws EMA dashed and SMA solid, matching the renderer", () => {
    const rows = buildLegendRows(only("sma", "ema"));
    expect(rows.filter((r) => r.dashed).map((r) => r.label)).toEqual([
      "EMA 12",
      "EMA 26",
    ]);
  });

  it("orders price overlays before the sub-panes", () => {
    const s = only("sma", "bollinger", "donchian", "vwap", "rsi", "volume", "volumeProfile");
    expect(buildLegendRows(s).map((r) => r.id)).toEqual([
      "sma", // one row per default length
      "sma",
      "bollinger",
      "donchian",
      "vwap",
      "rsi",
      "volume",
      "volumeProfile",
    ]);
  });

  it("labels the parameterised indicators with their settings", () => {
    const s = only("bollinger", "donchian", "rsi", "vwap");
    expect(buildLegendRows(s).map((r) => r.label)).toEqual([
      "BB 20, 2",
      "DC 20",
      "VWAP",
      "RSI 14",
    ]);
  });

  it("shows the VWAP length only when it is rolling", () => {
    const s = only("vwap");
    const rolling = { ...s, vwap: { ...s.vwap, anchor: "rolling" as const } };
    expect(buildLegendRows(rolling)[0].label).toBe("VWAP 20");
  });

  it("never emits trading sessions — it is background shading, not a line", () => {
    expect(buildLegendRows(only("sessions"))).toEqual([]);
  });

  it("keeps hidden lines in the legend, flagged", () => {
    const s = toggleHidden(only("sma"), "sma:20");
    const rows = buildLegendRows(s);
    expect(rows.map((r) => r.label)).toEqual(["SMA 20", "SMA 50"]);
    expect(rows.map((r) => r.hidden)).toEqual([true, false]);
  });

  // Colors are cycled by position, so filtering hidden lengths out of the
  // palette lookup would recolor every line after a hidden one.
  it("keeps a line's color stable when an earlier length is hidden", () => {
    const visible = buildLegendRows(only("sma"));
    const withHidden = buildLegendRows(toggleHidden(only("sma"), "sma:20"));
    expect(withHidden.map((r) => r.color)).toEqual(visible.map((r) => r.color));
    expect(withHidden[1].color).toBe(maColor(1));
  });

  it("prefers a custom color over the cycled palette", () => {
    const s = only("sma");
    const custom = { ...s, sma: { ...s.sma, colors: { 50: "#abcdef" } } };
    expect(buildLegendRows(custom)[1].color).toBe("#abcdef");
  });

  it("tolerates state persisted before `hidden` existed", () => {
    const legacy = only("sma");
    delete (legacy as Partial<IndicatorState>).hidden;
    expect(buildLegendRows(legacy).every((r) => r.hidden === false)).toBe(true);
  });
});
