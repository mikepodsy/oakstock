import { describe, it, expect } from "vitest";
import {
  bucketForGrade,
  buildFirmRatings,
  type RawGradeRow,
} from "./analystFirms";

const NOW = Date.parse("2026-08-15T00:00:00.000Z");
const DAY = 86_400_000;

function row(over: Partial<RawGradeRow> = {}): RawGradeRow {
  return {
    firm: "Some Bank",
    toGrade: "Buy",
    fromGrade: "Buy",
    action: "main",
    currentPriceTarget: 100,
    epochGradeDate: new Date(NOW - 10 * DAY).toISOString(),
    ...over,
  };
}

describe("bucketForGrade", () => {
  it("maps the wordings the big houses actually use", () => {
    // Sampled from live Yahoo data; no two banks phrase this the same way.
    expect(bucketForGrade("Strong Buy")).toBe("strongBuy");
    expect(bucketForGrade("Buy")).toBe("buy");
    expect(bucketForGrade("Overweight")).toBe("buy");
    expect(bucketForGrade("Outperform")).toBe("buy");
    expect(bucketForGrade("Sector Outperform")).toBe("buy");
    expect(bucketForGrade("Market Outperform")).toBe("buy");
    expect(bucketForGrade("Positive")).toBe("buy");
    expect(bucketForGrade("Long-Term Buy")).toBe("buy");
    expect(bucketForGrade("Neutral")).toBe("hold");
    expect(bucketForGrade("Hold")).toBe("hold");
    expect(bucketForGrade("Equal-Weight")).toBe("hold");
    expect(bucketForGrade("Market Perform")).toBe("hold");
    expect(bucketForGrade("Perform")).toBe("hold");
    expect(bucketForGrade("Underweight")).toBe("sell");
    expect(bucketForGrade("Underperform")).toBe("sell");
    expect(bucketForGrade("Sell")).toBe("sell");
    expect(bucketForGrade("Strong Sell")).toBe("strongSell");
  });

  it("ignores case and hyphenation, which Yahoo is inconsistent about", () => {
    // Both "Equal-Weight" and "Equal-weight" appear in the same GOOG response.
    expect(bucketForGrade("Equal-weight")).toBe("hold");
    expect(bucketForGrade("EQUAL WEIGHT")).toBe("hold");
    expect(bucketForGrade("  outperform  ")).toBe("buy");
  });

  it("returns null for grades it doesn't recognise", () => {
    // Yahoo emits empty strings, and houses invent new wordings. An unknown
    // grade must not be silently filed as a hold.
    expect(bucketForGrade("")).toBeNull();
    expect(bucketForGrade("Tactical Overweight Plus")).toBeNull();
    expect(bucketForGrade(undefined)).toBeNull();
  });
});

describe("buildFirmRatings", () => {
  it("keeps only each firm's most recent note", () => {
    const out = buildFirmRatings(
      [
        row({ firm: "UBS", toGrade: "Neutral", currentPriceTarget: 348, epochGradeDate: new Date(NOW - 200 * DAY).toISOString() }),
        row({ firm: "UBS", toGrade: "Buy", currentPriceTarget: 400, epochGradeDate: new Date(NOW - 5 * DAY).toISOString() }),
      ],
      NOW
    );
    expect(out).toHaveLength(1);
    expect(out[0].grade).toBe("Buy");
    expect(out[0].priceTarget).toBe(400);
  });

  it("sorts newest first, so the freshest opinion reads at the top", () => {
    const out = buildFirmRatings(
      [
        row({ firm: "A", epochGradeDate: new Date(NOW - 100 * DAY).toISOString() }),
        row({ firm: "B", epochGradeDate: new Date(NOW - 2 * DAY).toISOString() }),
        row({ firm: "C", epochGradeDate: new Date(NOW - 50 * DAY).toISOString() }),
      ],
      NOW
    );
    expect(out.map((f) => f.firm)).toEqual(["B", "C", "A"]);
  });

  it("drops notes older than the staleness window", () => {
    const out = buildFirmRatings(
      [
        row({ firm: "Fresh", epochGradeDate: new Date(NOW - 30 * DAY).toISOString() }),
        row({ firm: "Ancient", epochGradeDate: new Date(NOW - 900 * DAY).toISOString() }),
      ],
      NOW
    );
    expect(out.map((f) => f.firm)).toEqual(["Fresh"]);
  });

  it("does not resurrect a firm whose only recent note is unrecognisable", () => {
    const out = buildFirmRatings(
      [row({ firm: "Mystery Capital", toGrade: "" })],
      NOW
    );
    expect(out).toEqual([]);
  });

  it("keeps a firm whose price target is missing", () => {
    // A rating with no target is still a rating; the column just shows a dash.
    const out = buildFirmRatings(
      [row({ firm: "No Target LLP", currentPriceTarget: null })],
      NOW
    );
    expect(out).toHaveLength(1);
    expect(out[0].priceTarget).toBeNull();
  });

  it("skips rows with no firm name", () => {
    const out = buildFirmRatings([row({ firm: "" }), row({ firm: undefined })], NOW);
    expect(out).toEqual([]);
  });

  it("skips rows with an unparseable date", () => {
    const out = buildFirmRatings(
      [row({ firm: "Bad Date Bank", epochGradeDate: "not-a-date" })],
      NOW
    );
    expect(out).toEqual([]);
  });

  it("carries the firm's own wording through alongside the bucket", () => {
    const out = buildFirmRatings(
      [row({ firm: "JP Morgan", toGrade: "Overweight" })],
      NOW
    );
    expect(out[0]).toMatchObject({
      firm: "JP Morgan",
      grade: "Overweight",
      bucket: "buy",
      action: "main",
    });
  });

  it("records the date as a plain ISO day", () => {
    const out = buildFirmRatings(
      [row({ epochGradeDate: "2026-07-23T18:19:22.000Z" })],
      NOW
    );
    expect(out[0].date).toBe("2026-07-23");
  });

  it("returns an empty list for no history at all", () => {
    expect(buildFirmRatings([], NOW)).toEqual([]);
    expect(buildFirmRatings(undefined, NOW)).toEqual([]);
  });

  it("handles a Date object where Yahoo sometimes sends one", () => {
    const out = buildFirmRatings(
      [row({ epochGradeDate: new Date(NOW - DAY) })],
      NOW
    );
    expect(out).toHaveLength(1);
  });
});
