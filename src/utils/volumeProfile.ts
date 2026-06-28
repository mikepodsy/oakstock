// Volume-by-price (Volume Profile) aggregation. Given a set of candles, this
// bins their traded volume across equal price levels, splitting each candle's
// volume into "up" or "down" by its direction (close >= open). It also derives
// the Point of Control (highest-volume price) and the Value Area — the
// contiguous band around the POC holding ~70% of total volume.
//
// Pure + deterministic so it can be unit-tested and recomputed cheaply on every
// visible-range change. The renderer (volumeProfilePrimitive.ts) only maps the
// resulting prices to pixels.

import type { QuestradeCandle } from "@/types";

export interface VolumeBin {
  low: number; // price extent of the bin
  high: number;
  mid: number;
  up: number; // volume from up candles (close >= open)
  down: number; // volume from down candles
  total: number;
}

export interface VolumeProfile {
  bins: VolumeBin[];
  poc: number; // price (bin mid) with the most volume
  vah: number; // value-area high price
  val: number; // value-area low price
  maxBinTotal: number; // largest bin total — used to scale bar widths
  totalVolume: number;
}

// Build a volume profile from candles. Returns null when there's nothing
// meaningful to show (no candles, a degenerate price range, or zero volume).
export function computeVolumeProfile(
  candles: QuestradeCandle[],
  rows: number,
  valueAreaPct = 0.7
): VolumeProfile | null {
  if (candles.length === 0 || rows < 1) return null;

  let priceMin = Infinity;
  let priceMax = -Infinity;
  for (const c of candles) {
    if (c.low < priceMin) priceMin = c.low;
    if (c.high > priceMax) priceMax = c.high;
  }
  const range = priceMax - priceMin;
  if (!(range > 0)) return null;

  const binSize = range / rows;
  const bins: VolumeBin[] = [];
  for (let i = 0; i < rows; i++) {
    const low = priceMin + i * binSize;
    const high = low + binSize;
    bins.push({ low, high, mid: (low + high) / 2, up: 0, down: 0, total: 0 });
  }

  // Map a price to its bin index, clamped to the valid range.
  const indexOf = (price: number) =>
    Math.max(0, Math.min(rows - 1, Math.floor((price - priceMin) / binSize)));

  let totalVolume = 0;
  for (const c of candles) {
    if (c.volume <= 0) continue;
    totalVolume += c.volume;
    const lo = indexOf(c.low);
    const hi = indexOf(c.high);
    const span = hi - lo + 1;
    const per = c.volume / span; // spread evenly across the bins it overlaps
    const isUp = c.close >= c.open;
    for (let i = lo; i <= hi; i++) {
      if (isUp) bins[i].up += per;
      else bins[i].down += per;
      bins[i].total += per;
    }
  }

  if (totalVolume <= 0) return null;

  // Point of Control: the bin holding the most volume.
  let pocIdx = 0;
  let maxBinTotal = 0;
  for (let i = 0; i < rows; i++) {
    if (bins[i].total > maxBinTotal) {
      maxBinTotal = bins[i].total;
      pocIdx = i;
    }
  }

  // Value Area: grow outward from the POC, each step taking whichever adjacent
  // side holds more volume, until ~valueAreaPct of total volume is enclosed.
  let lo = pocIdx;
  let hi = pocIdx;
  let cum = bins[pocIdx].total;
  const target = valueAreaPct * totalVolume;
  while (cum < target && (lo > 0 || hi < rows - 1)) {
    const aboveVol = hi < rows - 1 ? bins[hi + 1].total : -1;
    const belowVol = lo > 0 ? bins[lo - 1].total : -1;
    if (aboveVol < 0 && belowVol < 0) break;
    if (aboveVol >= belowVol) {
      hi += 1;
      cum += aboveVol;
    } else {
      lo -= 1;
      cum += belowVol;
    }
  }

  return {
    bins,
    poc: bins[pocIdx].mid,
    vah: bins[hi].high,
    val: bins[lo].low,
    maxBinTotal,
    totalVolume,
  };
}
