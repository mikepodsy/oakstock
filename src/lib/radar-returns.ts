import YahooFinance from "yahoo-finance2";
import { getPeriodStartDate, getInterval } from "@/lib/history-utils";

const yf = new YahooFinance();

// "1d" is intentionally excluded — the Radar uses the live quote's day change for Today.
export const RADAR_RETURN_PERIODS = new Set(["1w", "1m", "3m", "ytd", "1y"]);

export interface ReturnBar {
  date: Date;
  close: number | null;
}

export interface SplitEvent {
  date: Date;
  numerator: number;
  denominator: number;
}

/**
 * % return from the first to the last close, corrected for stock splits.
 *
 * Yahoo's chart returns raw closes for recent splits, so a reverse split reads
 * as an enormous gain — PRPL's 1:25 on 2026-07-20 took its closes from $0.31 to
 * $6.50 overnight and ranked it as a +2100% monthly gainer when it was actually
 * down ~12%. Every close before a split is restated in post-split terms first.
 */
export function periodReturnFromBars(
  bars: ReturnBar[],
  splits: SplitEvent[]
): number | null {
  const usable = bars.filter(
    (b): b is { date: Date; close: number } => b.close != null
  );
  if (usable.length < 2) return null;

  const valid = splits.filter(
    (s) =>
      Number.isFinite(s.numerator) &&
      Number.isFinite(s.denominator) &&
      s.numerator > 0 &&
      s.denominator > 0
  );

  // A close is comparable to the latest price only after applying every split
  // that happened after it. 1:25 (reverse) scales earlier prices up by 25;
  // 4:1 (forward) scales them down by 4.
  const adjust = (bar: { date: Date; close: number }) =>
    valid.reduce(
      (price, s) =>
        s.date > bar.date ? (price * s.denominator) / s.numerator : price,
      bar.close
    );

  const first = adjust(usable[0]);
  const last = adjust(usable[usable.length - 1]);
  if (!first) return null;
  return ((last - first) / first) * 100;
}

/** Fetches a ticker's split-adjusted % return over the period. */
export async function fetchPeriodReturn(
  ticker: string,
  period: string
): Promise<number | null> {
  const result = await yf.chart(ticker, {
    period1: getPeriodStartDate(period),
    interval: getInterval(period),
  });

  const bars = result.quotes.map((q) => ({
    date: q.date,
    close: q.close ?? q.adjclose ?? null,
  }));

  return periodReturnFromBars(bars, result.events?.splits ?? []);
}
