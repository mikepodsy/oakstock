// Pure technical-indicator math for the candlestick chart. No React / charting
// imports beyond the UTCTimestamp brand. Each price helper returns points
// aligned to candle times, omitting leading points where there isn't enough
// data (the line simply starts later).

import type { UTCTimestamp } from "lightweight-charts";
import type { QuestradeCandle } from "@/types";

export interface LinePoint {
  time: UTCTimestamp;
  value: number;
}

export interface BandResult {
  upper: LinePoint[];
  middle: LinePoint[];
  lower: LinePoint[];
}

const ts = (c: QuestradeCandle): UTCTimestamp =>
  (Date.parse(c.time) / 1000) as UTCTimestamp;

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// Population standard deviation (divide by N) — the convention used by
// Bollinger Bands.
function stdDevPop(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}

// Simple moving average over the trailing `period` closes.
export function sma(candles: QuestradeCandle[], period: number): LinePoint[] {
  if (period < 1) return [];
  const out: LinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: ts(candles[i]), value: sum / period });
  }
  return out;
}

// Exponential moving average, seeded with the SMA of the first `period` closes.
export function ema(candles: QuestradeCandle[], period: number): LinePoint[] {
  if (period < 1 || candles.length < period) return [];
  const k = 2 / (period + 1);
  const out: LinePoint[] = [];
  let prev = 0;
  let seed = 0;
  for (let i = 0; i < candles.length; i++) {
    const close = candles[i].close;
    if (i < period - 1) {
      seed += close;
      continue;
    }
    if (i === period - 1) {
      seed += close;
      prev = seed / period;
    } else {
      prev = close * k + prev * (1 - k);
    }
    out.push({ time: ts(candles[i]), value: prev });
  }
  return out;
}

// Bollinger Bands: middle = SMA, upper/lower = middle ± mult · σ (population).
export function bollinger(
  candles: QuestradeCandle[],
  period: number,
  mult: number
): BandResult {
  const upper: LinePoint[] = [];
  const middle: LinePoint[] = [];
  const lower: LinePoint[] = [];
  if (period < 1) return { upper, middle, lower };
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1).map((c) => c.close);
    const m = mean(window);
    const sd = stdDevPop(window);
    const time = ts(candles[i]);
    middle.push({ time, value: m });
    upper.push({ time, value: m + mult * sd });
    lower.push({ time, value: m - mult * sd });
  }
  return { upper, middle, lower };
}

// Donchian Channels: rolling highest-high / lowest-low (incl. current bar) and
// their midline.
export function donchian(
  candles: QuestradeCandle[],
  period: number
): BandResult {
  const upper: LinePoint[] = [];
  const middle: LinePoint[] = [];
  const lower: LinePoint[] = [];
  if (period < 1) return { upper, middle, lower };
  for (let i = period - 1; i < candles.length; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > hi) hi = candles[j].high;
      if (candles[j].low < lo) lo = candles[j].low;
    }
    const time = ts(candles[i]);
    upper.push({ time, value: hi });
    lower.push({ time, value: lo });
    middle.push({ time, value: (hi + lo) / 2 });
  }
  return { upper, middle, lower };
}

// Relative Strength Index with Wilder smoothing. Returns values in [0, 100].
export function rsi(candles: QuestradeCandle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (period < 1 || candles.length <= period) return out;

  const rsiVal = (avgGain: number, avgLoss: number) =>
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gain += change;
    else loss -= change;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out.push({ time: ts(candles[period]), value: rsiVal(avgGain, avgLoss) });

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const g = change > 0 ? change : 0;
    const l = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out.push({ time: ts(candles[i]), value: rsiVal(avgGain, avgLoss) });
  }
  return out;
}

// --- US-equity trading sessions (intraday only) -----------------------------

export type Session = "pre" | "regular" | "after" | "closed";
export type ActiveSession = Exclude<Session, "closed">;

export interface SessionSegment {
  start: UTCTimestamp;
  end: UTCTimestamp;
  session: ActiveSession;
}

// Classify a unix-seconds timestamp into a US equity session using US Eastern
// wall-clock time (DST-correct via Intl). Pre 04:00–09:30, regular 09:30–16:00,
// after 16:00–20:00; weekends and everything else are "closed".
export function usEquitySession(timeSec: number): Session {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timeSec * 1000));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return "closed";

  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some environments emit "24" for midnight
  const minutes = hour * 60 + parseInt(get("minute"), 10);

  if (minutes >= 240 && minutes < 570) return "pre"; // 04:00–09:30
  if (minutes >= 570 && minutes < 960) return "regular"; // 09:30–16:00
  if (minutes >= 960 && minutes < 1200) return "after"; // 16:00–20:00
  return "closed";
}

// Collapse candles into contiguous session bands (skipping "closed" gaps) for
// background shading.
export function sessionSegments(candles: QuestradeCandle[]): SessionSegment[] {
  const segments: SessionSegment[] = [];
  let current: SessionSegment | null = null;

  for (const candle of candles) {
    const time = ts(candle);
    const session = usEquitySession(time);
    if (session === "closed") {
      if (current) {
        segments.push(current);
        current = null;
      }
      continue;
    }
    if (current && current.session === session) {
      current.end = time;
    } else {
      if (current) segments.push(current);
      current = { start: time, end: time, session };
    }
  }
  if (current) segments.push(current);
  return segments;
}
