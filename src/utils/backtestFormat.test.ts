import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatInt,
  formatParams,
  formatPct,
  formatRatio,
  formatStrategyName,
  metricTone,
} from "./backtestFormat";

describe("formatPct", () => {
  it("renders a fraction as a percentage", () => {
    expect(formatPct(0.1234)).toBe("12.34%");
  });

  it("keeps the negative sign", () => {
    expect(formatPct(-0.1901)).toBe("-19.01%");
  });

  it("adds an explicit plus only when asked", () => {
    expect(formatPct(0.16, 2, true)).toBe("+16.00%");
    expect(formatPct(0.16)).toBe("16.00%");
  });

  it("shows a dash rather than a fake zero for missing values", () => {
    // A backtest printing 0.00% when it means "not computed" reads as a result.
    expect(formatPct(null)).toBe("—");
    expect(formatPct(undefined)).toBe("—");
    expect(formatPct(NaN)).toBe("—");
    expect(formatPct(Infinity)).toBe("—");
  });

  it("still renders a genuine zero", () => {
    expect(formatPct(0)).toBe("0.00%");
  });
});

describe("formatRatio", () => {
  it("fixes to two decimals by default", () => {
    expect(formatRatio(0.7213)).toBe("0.72");
    expect(formatRatio(-1.85)).toBe("-1.85");
  });

  it("dashes non-finite input", () => {
    expect(formatRatio(Infinity)).toBe("—");
    expect(formatRatio(null)).toBe("—");
  });
});

describe("formatInt", () => {
  it("rounds and adds separators", () => {
    expect(formatInt(1004)).toBe("1,004");
  });

  it("dashes missing values", () => {
    expect(formatInt(null)).toBe("—");
  });
});

describe("formatDate", () => {
  it("renders an ISO day", () => {
    expect(formatDate("2026-08-14T00:00:00.000Z")).toBe("2026-08-14");
  });

  it("dashes null and unparseable input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatStrategyName", () => {
  it("turns registry keys into words", () => {
    expect(formatStrategyName("cot_index_reversal")).toBe("Cot Index Reversal");
    expect(formatStrategyName("buy_and_hold")).toBe("Buy And Hold");
  });
});

describe("formatParams", () => {
  it("renders key=value pairs", () => {
    expect(formatParams({ long_below: 20, short_above: 80 })).toBe(
      "long_below=20, short_above=80"
    );
  });

  it("dashes empty params", () => {
    expect(formatParams({})).toBe("—");
    expect(formatParams(null)).toBe("—");
  });
});

describe("metricTone", () => {
  it("treats positive as good by default", () => {
    expect(metricTone(0.16)).toBe("positive");
    expect(metricTone(-0.04)).toBe("negative");
  });

  it("inverts when lower is better", () => {
    // Drawdown is negative; a negative drawdown is not a *good* thing, but it
    // is the expected sign, so callers pass higherIsBetter=false.
    expect(metricTone(-0.19, false)).toBe("positive");
  });

  it("is neutral for zero and non-numbers", () => {
    expect(metricTone(0)).toBe("neutral");
    expect(metricTone(null)).toBe("neutral");
  });
});
