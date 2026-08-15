/**
 * The five-band verdict shared by the technical rating (computed from
 * indicators) and the analyst rating (consensus of sell-side recommendations).
 *
 * Both express themselves as a score in −1…1 so they can drive the same gauge:
 * −1 is maximally bearish, 0 neutral, 1 maximally bullish.
 */

export type Rating = "strongSell" | "sell" | "neutral" | "buy" | "strongBuy";

const RATING_LABEL: Record<Rating, string> = {
  strongSell: "Strong sell",
  sell: "Sell",
  neutral: "Neutral",
  buy: "Buy",
  strongBuy: "Strong buy",
};

const RATING_COLOR: Record<Rating, string> = {
  strongSell: "var(--red-primary)",
  sell: "var(--red-primary)",
  neutral: "var(--text-tertiary)",
  buy: "var(--green-primary)",
  strongBuy: "var(--green-primary)",
};

export function ratingLabel(rating: Rating): string {
  return RATING_LABEL[rating];
}

export function ratingColor(rating: Rating): string {
  return RATING_COLOR[rating];
}

/**
 * TradingView's bands. The edges belong to the calmer verdict: −0.5 is Sell
 * (not Strong sell), ±0.1 are Neutral, 0.5 is Buy.
 */
export function ratingFromScore(score: number): Rating {
  if (score < -0.5) return "strongSell";
  if (score < -0.1) return "sell";
  if (score <= 0.1) return "neutral";
  if (score <= 0.5) return "buy";
  return "strongBuy";
}
