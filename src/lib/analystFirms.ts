import type { AnalystDistribution, AnalystFirmRating } from "@/types";

/**
 * Firm-level ratings from Yahoo's `upgradeDowngradeHistory`, reduced to each
 * firm's current standing.
 *
 * The module is a log of every note ever published — 700+ rows for a widely
 * covered name — so "who rates this a Buy today" means the latest row per firm,
 * with anything stale dropped.
 */

export interface RawGradeRow {
  firm?: string | null;
  toGrade?: string | null;
  fromGrade?: string | null;
  action?: string | null;
  currentPriceTarget?: number | null;
  priorPriceTarget?: number | null;
  epochGradeDate?: string | Date | null;
}

/**
 * How long a note counts as a firm's current view.
 *
 * Two years is deliberately generous. Yahoo publishes notes for far fewer
 * analysts than it counts in `recommendationTrend` (7 of GOOG's 63 within a
 * year), and a tighter window empties the list for exactly the large caps
 * people look at most. Each row shows its date, so staleness stays visible
 * rather than being hidden by the cutoff.
 */
const MAX_AGE_MS = 730 * 86_400_000;

/**
 * Every house words its ratings differently — "Overweight", "Sector
 * Outperform" and "Positive" all mean buy. Keys are normalised (lowercased,
 * punctuation collapsed) before lookup.
 */
const GRADE_BUCKETS: Record<string, keyof AnalystDistribution> = {
  // Strong buy
  "strong buy": "strongBuy",
  "conviction buy": "strongBuy",
  "top pick": "strongBuy",
  "best idea": "strongBuy",

  // Buy
  buy: "buy",
  overweight: "buy",
  outperform: "buy",
  outperformer: "buy",
  "sector outperform": "buy",
  "market outperform": "buy",
  "sector overweight": "buy",
  positive: "buy",
  "long term buy": "buy",
  "speculative buy": "buy",
  accumulate: "buy",
  add: "buy",
  "above average": "buy",

  // Hold
  hold: "hold",
  neutral: "hold",
  "equal weight": "hold",
  "market perform": "hold",
  "sector perform": "hold",
  "peer perform": "hold",
  perform: "hold",
  "in line": "hold",
  average: "hold",
  "market weight": "hold",
  "sector weight": "hold",

  // Sell
  sell: "sell",
  underweight: "sell",
  underperform: "sell",
  underperformer: "sell",
  "sector underperform": "sell",
  "market underperform": "sell",
  reduce: "sell",
  negative: "sell",
  "below average": "sell",

  // Strong sell
  "strong sell": "strongSell",
  "conviction sell": "strongSell",
};

/**
 * The five-bucket equivalent of a firm's own wording, or null if unrecognised.
 *
 * Unknown wordings return null rather than defaulting to "hold": houses invent
 * new labels, and quietly filing an unread grade as neutral would put a made-up
 * opinion in front of the user.
 */
export function bucketForGrade(
  grade: string | null | undefined
): keyof AnalystDistribution | null {
  if (!grade) return null;
  const key = grade
    .toLowerCase()
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return GRADE_BUCKETS[key] ?? null;
}

function toTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Each firm's most recent recognisable rating, newest first.
 *
 * `now` is injected so the staleness window is testable.
 */
export function buildFirmRatings(
  history: RawGradeRow[] | null | undefined,
  now: number = Date.now()
): AnalystFirmRating[] {
  const latest = new Map<string, { time: number; rating: AnalystFirmRating }>();

  for (const row of history ?? []) {
    const firm = row.firm?.trim();
    if (!firm) continue;

    const time = toTime(row.epochGradeDate);
    if (time == null || now - time > MAX_AGE_MS) continue;

    const bucket = bucketForGrade(row.toGrade);
    if (!bucket) continue;

    const existing = latest.get(firm);
    if (existing && existing.time >= time) continue;

    latest.set(firm, {
      time,
      rating: {
        firm,
        grade: row.toGrade!.trim(),
        bucket,
        priceTarget:
          typeof row.currentPriceTarget === "number" &&
          Number.isFinite(row.currentPriceTarget)
            ? row.currentPriceTarget
            : null,
        date: new Date(time).toISOString().split("T")[0],
        action: row.action?.trim() || null,
      },
    });
  }

  return [...latest.values()]
    .sort((a, b) => b.time - a.time)
    .map((entry) => entry.rating);
}
