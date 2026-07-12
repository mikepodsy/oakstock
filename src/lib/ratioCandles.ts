export interface OhlcBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface RatioCandle {
  /** YYYY-MM-DD — accepted directly by lightweight-charts as a business day. */
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function isPositiveFinite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Build daily ratio candles (a / b) with the true bounds of the ratio inside
 * each bar: since a/b is increasing in `a` and decreasing in `b`, the ratio's
 * high is a.high/b.low and its low is a.low/b.high. Bars are aligned by date;
 * any day missing from either series, or with a non-positive denominator, is
 * skipped.
 */
export function computeRatioCandles(
  a: OhlcBar[],
  b: OhlcBar[],
  decimals = 4
): RatioCandle[] {
  const bByDate = new Map(b.map((bar) => [bar.date, bar]));
  const round = (n: number) => parseFloat(n.toFixed(decimals));

  const out: RatioCandle[] = [];
  for (const barA of a) {
    const barB = bByDate.get(barA.date);
    if (!barB) continue;
    if (
      !isPositiveFinite(barA.open) ||
      !isPositiveFinite(barA.high) ||
      !isPositiveFinite(barA.low) ||
      !isPositiveFinite(barA.close) ||
      !isPositiveFinite(barB.open) ||
      !isPositiveFinite(barB.high) ||
      !isPositiveFinite(barB.low) ||
      !isPositiveFinite(barB.close)
    ) {
      continue;
    }
    out.push({
      time: barA.date,
      open: round(barA.open / barB.open),
      high: round(barA.high / barB.low),
      low: round(barA.low / barB.high),
      close: round(barA.close / barB.close),
    });
  }
  return out;
}
