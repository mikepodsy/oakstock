// TradingView-style technical rating: 11 oscillators and 15 moving averages
// each vote Buy / Sell / Neutral on the latest bar, the two groups are scored
// separately, and the summary is the average of those two scores.
//
// These are TradingView's *published* rules, not a copy of their engine — the
// verdicts track closely but individual edge cases may differ.
//
// An indicator that can't be computed on the available history (a 200-period
// average on a short intraday window, say) votes `null` and is left out of its
// group's counts and score entirely. Voting it Neutral instead would drag every
// thin-data rating toward the middle.

import type { QuestradeCandle } from "@/types";
import type { LinePoint } from "./indicators";
import { ema, rsi, sma } from "./indicators";
import {
  adx,
  awesomeOscillator,
  bullBearPower,
  cci,
  hullMa,
  ichimokuBaseLine,
  macd,
  momentum,
  stochRsi,
  stochastic,
  ultimateOscillator,
  vwma,
  williamsR,
} from "./technicalIndicators";

export type Vote = "buy" | "sell" | "neutral";
export type Rating = "strongSell" | "sell" | "neutral" | "buy" | "strongBuy";

export interface IndicatorReading {
  name: string;
  /** The indicator's latest value, or null when there isn't enough history. */
  value: number | null;
  /** null when the indicator couldn't be computed — excluded from the score. */
  vote: Vote | null;
}

export interface RatingCounts {
  buy: number;
  sell: number;
  neutral: number;
}

export interface RatingGroup {
  readings: IndicatorReading[];
  counts: RatingCounts;
  /** (buys − sells) / computable indicators, so −1…1. */
  score: number;
  rating: Rating;
}

export interface TechnicalRating {
  oscillators: RatingGroup;
  movingAverages: RatingGroup;
  summary: {
    counts: RatingCounts;
    score: number;
    rating: Rating;
  };
}

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

const VOTE_COLOR: Record<Vote, string> = {
  buy: "var(--green-primary)",
  sell: "var(--red-primary)",
  neutral: "var(--text-tertiary)",
};

export function ratingLabel(rating: Rating): string {
  return RATING_LABEL[rating];
}

export function ratingColor(rating: Rating): string {
  return RATING_COLOR[rating];
}

export function voteLabel(vote: Vote): string {
  return vote === "buy" ? "Buy" : vote === "sell" ? "Sell" : "Neutral";
}

export function voteColor(vote: Vote): string {
  return VOTE_COLOR[vote];
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

/** Latest value of a series, or `back` points from the end. */
function at(points: LinePoint[], back = 0): number | null {
  const p = points[points.length - 1 - back];
  return p ? p.value : null;
}

function reading(
  name: string,
  value: number | null,
  vote: Vote | null
): IndicatorReading {
  return { name, value, vote: value == null ? null : vote };
}

/** Buy above the average, sell below it — the rule for all 14 price-vs-MA rows. */
function maReading(name: string, close: number, points: LinePoint[]): IndicatorReading {
  const v = at(points);
  if (v == null) return reading(name, null, null);
  return reading(name, v, close > v ? "buy" : close < v ? "sell" : "neutral");
}

function tally(readings: IndicatorReading[]): RatingGroup {
  const counts: RatingCounts = { buy: 0, sell: 0, neutral: 0 };
  for (const r of readings) {
    if (r.vote) counts[r.vote] += 1;
  }
  const total = counts.buy + counts.sell + counts.neutral;
  const score = total === 0 ? 0 : (counts.buy - counts.sell) / total;
  return { readings, counts, score, rating: ratingFromScore(score) };
}

function oscillatorReadings(candles: QuestradeCandle[]): IndicatorReading[] {
  const rsiPts = rsi(candles, 14);
  const stoch = stochastic(candles, 14, 3, 3);
  const cciPts = cci(candles, 20);
  const adxRes = adx(candles, 14);
  const ao = awesomeOscillator(candles);
  const mom = momentum(candles, 10);
  const macdRes = macd(candles, 12, 26, 9);
  const srsi = stochRsi(candles, 14, 14, 3, 3);
  const wr = williamsR(candles, 14);
  const bbp = bullBearPower(candles, 13);
  const uo = ultimateOscillator(candles, 7, 14, 28);

  const out: IndicatorReading[] = [];

  // RSI: buy below 30 while turning up, sell above 70 while turning down.
  {
    const v = at(rsiPts);
    const prev = at(rsiPts, 1);
    out.push(
      reading(
        "Relative Strength Index (14)",
        v,
        v == null || prev == null
          ? "neutral"
          : v < 30 && v > prev
            ? "buy"
            : v > 70 && v < prev
              ? "sell"
              : "neutral"
      )
    );
  }

  // Stochastic: both lines oversold and %K crossing up, or both overbought and
  // %K crossing down.
  {
    const k = at(stoch.k);
    const d = at(stoch.d);
    out.push(
      reading(
        "Stochastic %K (14, 3, 3)",
        k,
        k == null || d == null
          ? "neutral"
          : k < 20 && d < 20 && k > d
            ? "buy"
            : k > 80 && d > 80 && k < d
              ? "sell"
              : "neutral"
      )
    );
  }

  // CCI: buy below -100 while turning up, sell above 100 while turning down.
  {
    const v = at(cciPts);
    const prev = at(cciPts, 1);
    out.push(
      reading(
        "Commodity Channel Index (20)",
        v,
        v == null || prev == null
          ? "neutral"
          : v < -100 && v > prev
            ? "buy"
            : v > 100 && v < prev
              ? "sell"
              : "neutral"
      )
    );
  }

  // ADX: only votes once the trend is strong enough (>20), then follows DI.
  {
    const a = at(adxRes.adx);
    const plus = at(adxRes.plusDi);
    const minus = at(adxRes.minusDi);
    out.push(
      reading(
        "Average Directional Index (14)",
        a,
        a == null || plus == null || minus == null || a <= 20
          ? "neutral"
          : plus > minus
            ? "buy"
            : plus < minus
              ? "sell"
              : "neutral"
      )
    );
  }

  // Awesome Oscillator: a zero-line cross, or a saucer (two bars against the
  // move then one back with it) on the same side of zero.
  {
    const v = at(ao);
    const p1 = at(ao, 1);
    const p2 = at(ao, 2);
    let vote: Vote = "neutral";
    if (v != null && p1 != null) {
      const crossUp = v > 0 && p1 < 0;
      const crossDown = v < 0 && p1 > 0;
      const saucerUp = p2 != null && v > 0 && p1 < p2 && v > p1;
      const saucerDown = p2 != null && v < 0 && p1 > p2 && v < p1;
      if (crossUp || saucerUp) vote = "buy";
      else if (crossDown || saucerDown) vote = "sell";
    }
    out.push(reading("Awesome Oscillator", v, vote));
  }

  // Momentum: direction of the reading itself, not its sign.
  {
    const v = at(mom);
    const prev = at(mom, 1);
    out.push(
      reading(
        "Momentum (10)",
        v,
        v == null || prev == null ? "neutral" : v > prev ? "buy" : v < prev ? "sell" : "neutral"
      )
    );
  }

  // MACD: the line against its signal.
  {
    const line = at(macdRes.macd);
    const sig = at(macdRes.signal);
    out.push(
      reading(
        "MACD Level (12, 26)",
        line,
        line == null || sig == null
          ? "neutral"
          : line > sig
            ? "buy"
            : line < sig
              ? "sell"
              : "neutral"
      )
    );
  }

  // Stochastic RSI: oversold with %K above %D, or overbought with %K below.
  {
    const k = at(srsi.k);
    const d = at(srsi.d);
    out.push(
      reading(
        "Stochastic RSI Fast (3, 3, 14, 14)",
        k,
        k == null || d == null
          ? "neutral"
          : k < 20 && k > d
            ? "buy"
            : k > 80 && k < d
              ? "sell"
              : "neutral"
      )
    );
  }

  // Williams %R: buy below -80 while turning up, sell above -20 while turning down.
  {
    const v = at(wr);
    const prev = at(wr, 1);
    out.push(
      reading(
        "Williams Percent Range (14)",
        v,
        v == null || prev == null
          ? "neutral"
          : v < -80 && v > prev
            ? "buy"
            : v > -20 && v < prev
              ? "sell"
              : "neutral"
      )
    );
  }

  // Bull Bear Power: positive and growing, or negative and deepening.
  {
    const v = at(bbp);
    const prev = at(bbp, 1);
    out.push(
      reading(
        "Bull Bear Power",
        v,
        v == null || prev == null
          ? "neutral"
          : v > 0 && v > prev
            ? "buy"
            : v < 0 && v < prev
              ? "sell"
              : "neutral"
      )
    );
  }

  // Ultimate Oscillator: plain overbought / oversold levels.
  {
    const v = at(uo);
    out.push(
      reading(
        "Ultimate Oscillator (7, 14, 28)",
        v,
        v == null ? "neutral" : v > 70 ? "buy" : v < 30 ? "sell" : "neutral"
      )
    );
  }

  return out;
}

function movingAverageReadings(candles: QuestradeCandle[]): IndicatorReading[] {
  const close = candles[candles.length - 1].close;
  const out: IndicatorReading[] = [];

  for (const period of [10, 20, 30, 50, 100, 200]) {
    out.push(
      maReading(`Exponential Moving Average (${period})`, close, ema(candles, period))
    );
    out.push(maReading(`Simple Moving Average (${period})`, close, sma(candles, period)));
  }

  // Ichimoku is the one average that isn't a price-vs-line read: it votes only
  // on a conversion/base crossover that agrees with price, so it sits Neutral
  // most of the time.
  {
    const base = ichimokuBaseLine(candles, 26);
    const conversion = ichimokuBaseLine(candles, 9);
    const b = at(base);
    const bPrev = at(base, 1);
    const c = at(conversion);
    const cPrev = at(conversion, 1);
    let vote: Vote = "neutral";
    if (b != null && bPrev != null && c != null && cPrev != null) {
      const crossUp = cPrev <= bPrev && c > b;
      const crossDown = cPrev >= bPrev && c < b;
      if (b < close && crossUp) vote = "buy";
      else if (b > close && crossDown) vote = "sell";
    }
    out.push(reading("Ichimoku Base Line (9, 26, 52, 26)", b, vote));
  }

  out.push(
    maReading("Volume Weighted Moving Average (20)", close, vwma(candles, 20))
  );
  out.push(maReading("Hull Moving Average (9)", close, hullMa(candles, 9)));

  return out;
}

/**
 * Rates the latest bar. Returns null when there isn't enough history for even
 * the shortest indicator to mean anything.
 */
export function computeTechnicalRating(
  candles: QuestradeCandle[]
): TechnicalRating | null {
  if (candles.length < 15) return null;

  const oscillators = tally(oscillatorReadings(candles));
  const movingAverages = tally(movingAverageReadings(candles));

  const oscTotal =
    oscillators.counts.buy + oscillators.counts.sell + oscillators.counts.neutral;
  const maTotal =
    movingAverages.counts.buy +
    movingAverages.counts.sell +
    movingAverages.counts.neutral;

  // The summary averages the two group scores, so the 11 oscillators carry the
  // same weight as the 15 averages. A group with nothing computable is skipped
  // rather than counted as a zero.
  const scores = [
    ...(oscTotal > 0 ? [oscillators.score] : []),
    ...(maTotal > 0 ? [movingAverages.score] : []),
  ];
  const score =
    scores.length === 0 ? 0 : scores.reduce((s, v) => s + v, 0) / scores.length;

  return {
    oscillators,
    movingAverages,
    summary: {
      counts: {
        buy: oscillators.counts.buy + movingAverages.counts.buy,
        sell: oscillators.counts.sell + movingAverages.counts.sell,
        neutral: oscillators.counts.neutral + movingAverages.counts.neutral,
      },
      score,
      rating: ratingFromScore(score),
    },
  };
}
