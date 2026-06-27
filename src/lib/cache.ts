interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class TTLCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
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
    if (this.store.size > 2000) this.prune();
    this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

// Survive Next.js dev hot reloads by attaching to globalThis
function getOrCreateCache<T>(key: string, ttlSeconds: number): TTLCache<T> {
  const globalKey = `__cache_${key}`;
  const g = globalThis as Record<string, unknown>;
  if (!g[globalKey]) {
    g[globalKey] = new TTLCache<T>(ttlSeconds);
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
export const radarCache = getOrCreateCache<string[]>("radar", 120);
// Period % return per ticker for Radar timeframes. null = known-failed (skip refetch).
export const radarReturnsCache = getOrCreateCache<number | null>("radar-returns", 300);
// Questrade symbolId rarely changes — cache it long. Candles cache stays short.
export const questradeSymbolCache = getOrCreateCache<number | null>("questrade-symbol", 86400);
export const questradeCandlesCache = getOrCreateCache<unknown[]>("questrade-candles", 300);
// Options strike breakdown. Short TTL so intraday volume stays fresh; open
// interest only changes once a day so the rest of the payload is stable.
export const questradeOptionsCache = getOrCreateCache<unknown>("questrade-options", 60);
