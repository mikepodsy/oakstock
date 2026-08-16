import { describe, it, expect, vi, afterEach } from "vitest";
import { TTLCache } from "./cache";

afterEach(() => vi.useRealTimers());

describe("TTLCache", () => {
  it("returns stored values before they expire", () => {
    const cache = new TTLCache<number>(60);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("distinguishes a stored null from a missing key", () => {
    const cache = new TTLCache<number | null>(60);
    cache.set("dead", null);
    expect(cache.get("dead")).toBeNull();
    expect(cache.get("never-set")).toBeUndefined();
  });

  it("expires values once the TTL has passed", () => {
    vi.useFakeTimers();
    const cache = new TTLCache<number>(60);
    cache.set("a", 1);
    vi.advanceTimersByTime(61_000);
    expect(cache.get("a")).toBeUndefined();
  });

  // Ranking the full Radar universe writes ~1,900 entries per timeframe, so an
  // all-live cache must still be bounded or the process leaks memory.
  it("stays bounded when every entry is still live", () => {
    const cache = new TTLCache<number>(3600, 100);
    for (let i = 0; i < 500; i++) cache.set(`k${i}`, i);
    expect(cache.size).toBeLessThanOrEqual(100);
  });

  it("evicts the oldest entries first when over capacity", () => {
    const cache = new TTLCache<number>(3600, 10);
    for (let i = 0; i < 15; i++) cache.set(`k${i}`, i);
    expect(cache.get("k0")).toBeUndefined();
    expect(cache.get("k14")).toBe(14);
  });

  it("drops expired entries before evicting live ones", () => {
    vi.useFakeTimers();
    const cache = new TTLCache<number>(60, 10);
    for (let i = 0; i < 8; i++) cache.set(`old${i}`, i);
    vi.advanceTimersByTime(61_000);
    for (let i = 0; i < 8; i++) cache.set(`new${i}`, i);
    expect(cache.get("new0")).toBe(0);
    expect(cache.size).toBe(8);
  });
});
