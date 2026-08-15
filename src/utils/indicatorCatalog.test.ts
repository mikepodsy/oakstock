import { describe, it, expect } from "vitest";
import {
  INDICATOR_CATALOG,
  INDICATOR_CATEGORIES,
  countActive,
  matchesQuery,
} from "./indicatorCatalog";
import {
  DEFAULT_INDICATORS,
  toggleIndicator,
  type IndicatorId,
} from "./indicatorConfig";

describe("INDICATOR_CATALOG", () => {
  // The picker is the only way to add an indicator, so a chart indicator with
  // no catalog entry would be unreachable.
  it("has exactly one entry per indicator in the state", () => {
    const stateIds = Object.keys(DEFAULT_INDICATORS).filter(
      (k) => k !== "hidden"
    ) as IndicatorId[];
    const catalogIds = INDICATOR_CATALOG.map((e) => e.id);

    expect([...catalogIds].sort()).toEqual([...stateIds].sort());
    expect(new Set(catalogIds).size).toBe(catalogIds.length);
  });

  it("puts every entry in a category the sidebar renders", () => {
    const known = new Set(INDICATOR_CATEGORIES.map((c) => c.id));
    for (const e of INDICATOR_CATALOG) expect(known.has(e.category)).toBe(true);
  });
});

describe("matchesQuery", () => {
  const bollinger = INDICATOR_CATALOG.find((e) => e.id === "bollinger")!;

  it("matches everything on an empty query", () => {
    expect(matchesQuery(bollinger, "")).toBe(true);
    expect(matchesQuery(bollinger, "   ")).toBe(true);
  });

  it("matches the label regardless of case", () => {
    expect(matchesQuery(bollinger, "BOLL")).toBe(true);
    expect(matchesQuery(bollinger, "bands")).toBe(true);
  });

  it("matches an alias the label does not contain", () => {
    expect(matchesQuery(bollinger, "bb")).toBe(true);
  });

  it("rejects a non-match", () => {
    expect(matchesQuery(bollinger, "ichimoku")).toBe(false);
  });
});

describe("countActive", () => {
  it("counts enabled indicators", () => {
    // Volume is the only default-on indicator.
    expect(countActive(DEFAULT_INDICATORS, false)).toBe(1);
    expect(countActive(toggleIndicator(DEFAULT_INDICATORS, "rsi"), false)).toBe(2);
  });

  it("counts trading sessions only on intraday intervals, where it draws", () => {
    const s = toggleIndicator(DEFAULT_INDICATORS, "sessions");
    expect(countActive(s, false)).toBe(1);
    expect(countActive(s, true)).toBe(2);
  });
});
