import { rankReturns, type MoverDirection, type RankedMover } from "@/utils/radarRanking";

/** Minimal view of the shared TTL cache, so this stays unit-testable. */
export interface MoversCache {
  get(key: string): number | null | undefined;
  set(key: string, value: number | null): void;
}

export interface ComputeMoversArgs {
  universe: string[];
  period: string;
  direction: MoverDirection;
  limit: number;
  cache: MoversCache;
  /** Resolves a ticker's % return over the period; null when it has no data. */
  fetchReturn: (ticker: string, period: string) => Promise<number | null | undefined>;
  concurrency?: number;
  /** Wall-clock budget for *fetching*; the pass returns early once it's spent. */
  budgetMs?: number;
  now?: () => number;
}

export interface MoversResult {
  ranked: RankedMover[];
  universeSize: number;
  /** Universe members whose return is now known (including known-dead ones). */
  covered: number;
  /** False when the budget ran out before the whole universe was resolved. */
  complete: boolean;
}

const DEFAULT_CONCURRENCY = 32;

export const moversCacheKey = (ticker: string, period: string) => `${ticker}:${period}`;

/**
 * Ranks a universe by each ticker's actual return over the period.
 *
 * Yahoo has no market-wide weekly/monthly screener, so a period ranking has to
 * be computed ticker by ticker. That is too slow to finish in one request for
 * the full ~1,500-name universe, so a pass runs until its time budget is spent
 * and reports `complete: false`; every resolved return is written to the shared
 * cache, letting the next pass pick up where this one stopped.
 */
export async function computeMovers({
  universe,
  period,
  direction,
  limit,
  cache,
  fetchReturn,
  concurrency = DEFAULT_CONCURRENCY,
  budgetMs = Infinity,
  now = Date.now,
}: ComputeMoversArgs): Promise<MoversResult> {
  const returns: Record<string, number | null> = {};
  const pending: string[] = [];

  for (const ticker of universe) {
    const cached = cache.get(moversCacheKey(ticker, period));
    // `null` is a cached "no data" marker — skip it rather than refetching.
    if (cached !== undefined) returns[ticker] = cached;
    else pending.push(ticker);
  }

  const start = now();
  let resolved = 0;

  for (let i = 0; i < pending.length; i += concurrency) {
    if (now() - start >= budgetMs) break;

    const batch = pending.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (ticker) => {
        const change = await fetchReturn(ticker, period);
        return { ticker, change: typeof change === "number" ? change : null };
      })
    );

    settled.forEach((outcome, j) => {
      // A rejection here means delisted or a bad symbol — cache it as dead so
      // the next pass spends its budget on tickers that can still resolve.
      const ticker = batch[j];
      const change = outcome.status === "fulfilled" ? outcome.value.change : null;
      cache.set(moversCacheKey(ticker, period), change);
      returns[ticker] = change;
      resolved++;
    });
  }

  return {
    ranked: rankReturns(returns, direction, limit),
    universeSize: universe.length,
    covered: universe.length - pending.length + resolved,
    complete: resolved === pending.length,
  };
}
