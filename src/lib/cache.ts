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
    if (this.store.size > 500) this.prune();
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

export const quoteCache = getOrCreateCache<Record<string, unknown>>("quotes", 60);
export const historyCache = getOrCreateCache<Array<{ date: string; close: number }>>("history", 600);
export const financialsCache = getOrCreateCache<Record<string, unknown>>("financials", 1800);
export const fundamentalsCache = getOrCreateCache<Record<string, unknown>>("fundamentals-ts", 3600);
export const calendarCache = getOrCreateCache<unknown[]>("calendar", 3600);
