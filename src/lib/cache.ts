interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 2000;

export class TTLCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;
  private maxEntries: number;

  constructor(ttlSeconds: number, maxEntries = DEFAULT_MAX_ENTRIES) {
    this.ttlMs = ttlSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  get size(): number {
    return this.store.size;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    if (this.store.size >= this.maxEntries) this.evict();
    this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  // Drop expired entries first; if the cache is still full they're all live, so
  // fall back to evicting the oldest (Map iterates in insertion order).
  private evict(): void {
    this.prune();
    for (const key of this.store.keys()) {
      if (this.store.size < this.maxEntries) break;
      this.store.delete(key);
    }
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

// Survive Next.js dev hot reloads by attaching to globalThis
function getOrCreateCache<T>(
  key: string,
  ttlSeconds: number,
  maxEntries?: number
): TTLCache<T> {
  const globalKey = `__cache_${key}`;
  const g = globalThis as Record<string, unknown>;
  if (!g[globalKey]) {
    g[globalKey] = new TTLCache<T>(ttlSeconds, maxEntries);
  }
  return g[globalKey] as TTLCache<T>;
}

export const quoteCache = getOrCreateCache<Record<string, unknown>>("quotes", 300);
export const historyCache = getOrCreateCache<Array<{ date: string; close: number }>>("history", 1800);
export const financialsCache = getOrCreateCache<Record<string, unknown>>("financials", 1800);
export const fundamentalsCache = getOrCreateCache<Record<string, unknown>>("fundamentals-ts", 3600);
export const calendarCache = getOrCreateCache<unknown[]>("calendar", 3600);
export const economicCache = getOrCreateCache<unknown>("economic", 3600);
export const marketCache = getOrCreateCache<unknown>("market", 3600);
export const treasuryCache = getOrCreateCache<unknown>("treasury", 3600);
export const cotCache = getOrCreateCache<unknown[]>("cot", 86400);
// SEC EDGAR ticker→CIK map rarely changes — cache the whole map for a day.
// null = ticker known to have no CIK (skip refetch within TTL).
export const edgarCikCache = getOrCreateCache<Record<string, string> | null>("edgar-cik", 86400);
// SEC mutual-fund/ETF ticker→{cik,seriesId} map. Like edgarCikCache, the whole
// directory rarely changes — cache it for a day. null = fetch failed.
export const edgarFundCache = getOrCreateCache<Record<string, { cik: string; seriesId: string }> | null>("edgar-fund", 86400);
// Parsed ETF holdings per ticker (from the latest NPORT-P filing). NPORT is
// filed quarterly, so a day-long TTL is plenty. null = no holdings available.
export const etfHoldingsCache = getOrCreateCache<unknown>("etf-holdings", 86400);
// Reverse SEC directory: normalized company name -> ticker, for turning ETF
// holding names into stock-page links. Whole map cached for a day.
export const edgarNameTickerCache = getOrCreateCache<Record<string, string> | null>("edgar-name-ticker", 86400);
export const radarCache = getOrCreateCache<string[]>("radar", 120);
// Period % return per ticker for Radar timeframes. null = known-failed (skip refetch).
// Ranking the full universe is ~1,500 chart calls, so the TTL is long enough for
// that crawl to amortize — 1W+ returns barely move in 15 minutes anyway. Capacity
// holds the whole universe across all five timeframes so a ranking pass can't
// evict the entries an earlier pass just paid for.
export const radarReturnsCache = getOrCreateCache<number | null>(
  "radar-returns",
  900,
  12_000
);
// Questrade symbolId rarely changes — cache it long. Candles cache stays short.
export const questradeSymbolCache = getOrCreateCache<number | null>("questrade-symbol", 86400);
export const questradeCandlesCache = getOrCreateCache<unknown[]>("questrade-candles", 300);
// Options strike breakdown. Short TTL so intraday volume stays fresh; open
// interest only changes once a day so the rest of the payload is stable.
export const questradeOptionsCache = getOrCreateCache<unknown>("questrade-options", 60);
// Per-expiry option chain with per-contract quotes/greeks for the position
// builder. Keyed TICKER:EXPIRY; short TTL so bid/ask/IV stay live.
export const optionChainCache = getOrCreateCache<unknown>("option-chain", 60);
// Assembled volatility dashboard (IV/HV history + term structure + skew).
// Keyed TICKER; 30-min TTL — history is daily, term/skew tolerate slight lag.
export const volatilityCache = getOrCreateCache<unknown>("volatility", 1800);
// Analyst consensus, price targets and EPS estimates. Keyed TICKER; 30-min TTL
// — sell-side revisions land daily at most, so this is generous but harmless.
export const analystCache = getOrCreateCache<unknown>("analyst", 1800);
