// The technical-indicator math the rating widget needs on top of what
// indicators.ts already provides for the chart. Same rules as that file: pure,
// no React or charting imports beyond the UTCTimestamp brand, `LinePoint[]` out
// with leading points omitted where there isn't enough data.
//
// Internally everything works on `Series` — a null-padded array index-aligned to
// the candles — because these indicators feed each other (MACD is an EMA of a
// difference of EMAs, Hull is a WMA of WMAs) and alignment is where that gets
// fiddly. `toPoints` drops the nulls at the end.

import type { UTCTimestamp } from "lightweight-charts";
import type { QuestradeCandle } from "@/types";
import type { LinePoint } from "./indicators";
import { rsi } from "./indicators";

/** One value per candle; null where the indicator isn't defined yet. */
type Series = (number | null)[];

const ts = (c: QuestradeCandle): UTCTimestamp =>
  (Date.parse(c.time) / 1000) as UTCTimestamp;

function toPoints(candles: QuestradeCandle[], series: Series): LinePoint[] {
  const out: LinePoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = series[i];
    if (v != null && Number.isFinite(v)) out.push({ time: ts(candles[i]), value: v });
  }
  return out;
}

function emptySeries(len: number): Series {
  return new Array<number | null>(len).fill(null);
}

/** Pads a trailing-aligned value list back out to full candle length. */
function alignTrailing(values: number[], len: number): Series {
  const out = emptySeries(len);
  const offset = len - values.length;
  for (let i = 0; i < values.length; i++) out[offset + i] = values[i];
  return out;
}

function smaSeries(values: Series, period: number): Series {
  const out = emptySeries(values.length);
  if (period < 1) return out;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v == null) {
        ok = false;
        break;
      }
      sum += v;
    }
    if (ok) out[i] = sum / period;
  }
  return out;
}

/** Linearly weighted average — the newest bar carries weight `period`. */
function wmaSeries(values: Series, period: number): Series {
  const out = emptySeries(values.length);
  if (period < 1) return out;
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    let ok = true;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      if (v == null) {
        ok = false;
        break;
      }
      sum += v * (j + 1);
    }
    if (ok) out[i] = sum / denom;
  }
  return out;
}

/** EMA seeded with the SMA of the first `period` defined values. */
function emaSeries(values: Series, period: number): Series {
  const out = emptySeries(values.length);
  if (period < 1) return out;

  const start = values.findIndex((v) => v != null);
  if (start < 0 || values.length - start < period) return out;

  let seed = 0;
  for (let i = start; i < start + period; i++) seed += values[i] ?? 0;
  let prev = seed / period;
  out[start + period - 1] = prev;

  const k = 2 / (period + 1);
  for (let i = start + period; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function closeSeries(candles: QuestradeCandle[]): Series {
  return candles.map((c) => c.close);
}

function highestHigh(candles: QuestradeCandle[], end: number, period: number): number {
  let hh = -Infinity;
  for (let i = end - period + 1; i <= end; i++) hh = Math.max(hh, candles[i].high);
  return hh;
}

function lowestLow(candles: QuestradeCandle[], end: number, period: number): number {
  let ll = Infinity;
  for (let i = end - period + 1; i <= end; i++) ll = Math.min(ll, candles[i].low);
  return ll;
}

// ── Oscillators ────────────────────────────────────────────────────────────

/** Close minus the close `period` bars ago. */
export function momentum(candles: QuestradeCandle[], period: number): LinePoint[] {
  const out = emptySeries(candles.length);
  for (let i = period; i < candles.length; i++) {
    out[i] = candles[i].close - candles[i - period].close;
  }
  return toPoints(candles, out);
}

/**
 * Williams %R — where the close sits in the period's range, on a 0 (top) to
 * -100 (bottom) scale. A range of zero has no meaningful position, so it reads
 * as the midpoint rather than dividing by zero.
 */
export function williamsR(candles: QuestradeCandle[], period: number): LinePoint[] {
  const out = emptySeries(candles.length);
  for (let i = period - 1; i < candles.length; i++) {
    const hh = highestHigh(candles, i, period);
    const ll = lowestLow(candles, i, period);
    const range = hh - ll;
    // Written as (close - hh) rather than -(hh - close) so a close sitting
    // exactly on the high reads 0, not -0.
    out[i] = range === 0 ? -50 : ((candles[i].close - hh) / range) * 100;
  }
  return toPoints(candles, out);
}

/** Commodity Channel Index: typical-price deviation scaled by 0.015 × mean deviation. */
export function cci(candles: QuestradeCandle[], period: number): LinePoint[] {
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const out = emptySeries(candles.length);
  for (let i = period - 1; i < candles.length; i++) {
    const window = tp.slice(i - period + 1, i + 1);
    const avg = window.reduce((s, v) => s + v, 0) / period;
    const md = window.reduce((s, v) => s + Math.abs(v - avg), 0) / period;
    out[i] = md === 0 ? 0 : (tp[i] - avg) / (0.015 * md);
  }
  return toPoints(candles, out);
}

export interface StochasticResult {
  k: LinePoint[];
  d: LinePoint[];
}

/**
 * Stochastic %K/%D. `kPeriod` sets the high-low window, `kSmooth` smooths the
 * raw stochastic into %K, `dPeriod` smooths %K into %D — the (14, 3, 3) that
 * TradingView reports is kPeriod 14, kSmooth 3, dPeriod 3.
 */
export function stochastic(
  candles: QuestradeCandle[],
  kPeriod: number,
  kSmooth: number,
  dPeriod: number
): StochasticResult {
  const raw = emptySeries(candles.length);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const hh = highestHigh(candles, i, kPeriod);
    const ll = lowestLow(candles, i, kPeriod);
    const range = hh - ll;
    raw[i] = range === 0 ? 50 : ((candles[i].close - ll) / range) * 100;
  }
  const k = smaSeries(raw, kSmooth);
  const d = smaSeries(k, dPeriod);
  return { k: toPoints(candles, k), d: toPoints(candles, d) };
}

/** Stochastic RSI — the stochastic formula applied to the RSI series. */
export function stochRsi(
  candles: QuestradeCandle[],
  rsiPeriod: number,
  stochPeriod: number,
  kSmooth: number,
  dSmooth: number
): StochasticResult {
  const r = alignTrailing(
    rsi(candles, rsiPeriod).map((p) => p.value),
    candles.length
  );

  const raw = emptySeries(candles.length);
  for (let i = stochPeriod - 1; i < candles.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    let ok = true;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const v = r[j];
      if (v == null) {
        ok = false;
        break;
      }
      hh = Math.max(hh, v);
      ll = Math.min(ll, v);
    }
    if (!ok) continue;
    const range = hh - ll;
    raw[i] = range === 0 ? 50 : (((r[i] as number) - ll) / range) * 100;
  }

  const k = smaSeries(raw, kSmooth);
  const d = smaSeries(k, dSmooth);
  return { k: toPoints(candles, k), d: toPoints(candles, d) };
}

export interface MacdResult {
  macd: LinePoint[];
  signal: LinePoint[];
  histogram: LinePoint[];
}

export function macd(
  candles: QuestradeCandle[],
  fast: number,
  slow: number,
  signalPeriod: number
): MacdResult {
  const closes = closeSeries(candles);
  const fastE = emaSeries(closes, fast);
  const slowE = emaSeries(closes, slow);

  const line = emptySeries(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const f = fastE[i];
    const s = slowE[i];
    if (f != null && s != null) line[i] = f - s;
  }

  const signal = emaSeries(line, signalPeriod);
  const histogram = emptySeries(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const l = line[i];
    const s = signal[i];
    if (l != null && s != null) histogram[i] = l - s;
  }

  return {
    macd: toPoints(candles, line),
    signal: toPoints(candles, signal),
    histogram: toPoints(candles, histogram),
  };
}

export interface AdxResult {
  adx: LinePoint[];
  plusDi: LinePoint[];
  minusDi: LinePoint[];
}

/** Wilder's ADX with its +DI / -DI components. */
export function adx(candles: QuestradeCandle[], period: number): AdxResult {
  const n = candles.length;
  const adxOut = emptySeries(n);
  const plusOut = emptySeries(n);
  const minusOut = emptySeries(n);
  if (n < period * 2) {
    return {
      adx: toPoints(candles, adxOut),
      plusDi: toPoints(candles, plusOut),
      minusDi: toPoints(candles, minusOut),
    };
  }

  // Per-bar true range and directional movement (undefined for the first bar).
  const tr: number[] = [0];
  const plusDm: number[] = [0];
  const minusDm: number[] = [0];
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    tr.push(
      Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close))
    );
    const up = c.high - p.high;
    const down = p.low - c.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }

  // Wilder smoothing: seed with the first `period` sums, then decay one
  // period's worth each bar.
  let smTr = 0;
  let smPlus = 0;
  let smMinus = 0;
  for (let i = 1; i <= period; i++) {
    smTr += tr[i];
    smPlus += plusDm[i];
    smMinus += minusDm[i];
  }

  const dx: number[] = [];
  let dxStart = -1;

  for (let i = period; i < n; i++) {
    if (i > period) {
      smTr = smTr - smTr / period + tr[i];
      smPlus = smPlus - smPlus / period + plusDm[i];
      smMinus = smMinus - smMinus / period + minusDm[i];
    }
    const pdi = smTr === 0 ? 0 : (100 * smPlus) / smTr;
    const mdi = smTr === 0 ? 0 : (100 * smMinus) / smTr;
    plusOut[i] = pdi;
    minusOut[i] = mdi;

    const sum = pdi + mdi;
    if (dxStart < 0) dxStart = i;
    dx.push(sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum);
  }

  // ADX is Wilder's average of DX, so it needs another `period` bars.
  if (dx.length >= period) {
    let a = dx.slice(0, period).reduce((s, v) => s + v, 0) / period;
    adxOut[dxStart + period - 1] = a;
    for (let j = period; j < dx.length; j++) {
      a = (a * (period - 1) + dx[j]) / period;
      adxOut[dxStart + j] = a;
    }
  }

  return {
    adx: toPoints(candles, adxOut),
    plusDi: toPoints(candles, plusOut),
    minusDi: toPoints(candles, minusOut),
  };
}

/** Awesome Oscillator: 5-bar minus 34-bar SMA of the median price. */
export function awesomeOscillator(candles: QuestradeCandle[]): LinePoint[] {
  const median: Series = candles.map((c) => (c.high + c.low) / 2);
  const fast = smaSeries(median, 5);
  const slow = smaSeries(median, 34);
  const out = emptySeries(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const f = fast[i];
    const s = slow[i];
    if (f != null && s != null) out[i] = f - s;
  }
  return toPoints(candles, out);
}

/**
 * Bull Bear Power — how far the bar's high and low sit either side of the
 * 13-bar EMA. Positive means buyers reached further above the average than
 * sellers reached below it.
 */
export function bullBearPower(
  candles: QuestradeCandle[],
  period = 13
): LinePoint[] {
  const e = emaSeries(closeSeries(candles), period);
  const out = emptySeries(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const v = e[i];
    if (v != null) out[i] = candles[i].high - v + (candles[i].low - v);
  }
  return toPoints(candles, out);
}

/** Ultimate Oscillator — buying pressure over true range at three horizons. */
export function ultimateOscillator(
  candles: QuestradeCandle[],
  p1: number,
  p2: number,
  p3: number
): LinePoint[] {
  const n = candles.length;
  const out = emptySeries(n);
  const bp: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    const low = Math.min(c.low, prevClose);
    bp.push(c.close - low);
    tr.push(Math.max(c.high, prevClose) - low);
  }

  const avg = (end: number, period: number): number | null => {
    if (end - period + 1 < 0) return null;
    let sumBp = 0;
    let sumTr = 0;
    for (let i = end - period + 1; i <= end; i++) {
      sumBp += bp[i];
      sumTr += tr[i];
    }
    return sumTr === 0 ? null : sumBp / sumTr;
  };

  for (let j = 0; j < bp.length; j++) {
    const a1 = avg(j, p1);
    const a2 = avg(j, p2);
    const a3 = avg(j, p3);
    if (a1 == null || a2 == null || a3 == null) continue;
    // bp/tr start one bar in, so index j is candle j + 1.
    out[j + 1] = (100 * (4 * a1 + 2 * a2 + a3)) / 7;
  }

  return toPoints(candles, out);
}

// ── Moving averages ────────────────────────────────────────────────────────

/** Ichimoku base line (Kijun-sen): midpoint of the period's high and low. */
export function ichimokuBaseLine(
  candles: QuestradeCandle[],
  period = 26
): LinePoint[] {
  const out = emptySeries(candles.length);
  for (let i = period - 1; i < candles.length; i++) {
    out[i] = (highestHigh(candles, i, period) + lowestLow(candles, i, period)) / 2;
  }
  return toPoints(candles, out);
}

/**
 * Volume-weighted moving average. A window with no volume at all (some series
 * carry none) falls back to the simple average rather than dividing by zero.
 */
export function vwma(candles: QuestradeCandle[], period: number): LinePoint[] {
  const out = emptySeries(candles.length);
  for (let i = period - 1; i < candles.length; i++) {
    let pv = 0;
    let vol = 0;
    let closes = 0;
    for (let j = i - period + 1; j <= i; j++) {
      pv += candles[j].close * candles[j].volume;
      vol += candles[j].volume;
      closes += candles[j].close;
    }
    out[i] = vol === 0 ? closes / period : pv / vol;
  }
  return toPoints(candles, out);
}

/** Hull moving average: WMA(2·WMA(n/2) − WMA(n), √n). */
export function hullMa(candles: QuestradeCandle[], period: number): LinePoint[] {
  const closes = closeSeries(candles);
  const half = wmaSeries(closes, Math.floor(period / 2));
  const full = wmaSeries(closes, period);

  const raw = emptySeries(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const h = half[i];
    const f = full[i];
    if (h != null && f != null) raw[i] = 2 * h - f;
  }

  return toPoints(candles, wmaSeries(raw, Math.round(Math.sqrt(period))));
}
