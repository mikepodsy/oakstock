import { describe, it, expect, vi } from "vitest";
import { computeMovers } from "./radar-movers";

function makeCache(seed: Record<string, number | null> = {}) {
  const store = new Map<string, number | null>(Object.entries(seed));
  return {
    store,
    get: (k: string) => (store.has(k) ? store.get(k)! : undefined),
    set: (k: string, v: number | null) => void store.set(k, v),
  };
}

describe("computeMovers", () => {
  it("ranks the universe by its return over the period, not by today's move", async () => {
    const cache = makeCache();
    const prices: Record<string, number> = { AAA: 2, BBB: 30, CCC: 11, DDD: -4 };
    const result = await computeMovers({
      universe: ["AAA", "BBB", "CCC", "DDD"],
      period: "1w",
      direction: "gainers",
      limit: 3,
      cache,
      fetchReturn: async (t) => prices[t],
    });

    expect(result.ranked).toEqual([
      { ticker: "BBB", change: 30 },
      { ticker: "CCC", change: 11 },
      { ticker: "AAA", change: 2 },
    ]);
    expect(result.complete).toBe(true);
    expect(result.universeSize).toBe(4);
  });

  it("reuses cached returns instead of refetching them", async () => {
    const cache = makeCache({ "AAA:1w": 9, "BBB:1w": 1 });
    const fetchReturn = vi.fn(async () => 0);

    const result = await computeMovers({
      universe: ["AAA", "BBB"],
      period: "1w",
      direction: "gainers",
      limit: 5,
      cache,
      fetchReturn,
    });

    expect(fetchReturn).not.toHaveBeenCalled();
    expect(result.ranked).toEqual([
      { ticker: "AAA", change: 9 },
      { ticker: "BBB", change: 1 },
    ]);
  });

  it("keys the cache by period so a weekly view never reads monthly returns", async () => {
    const cache = makeCache({ "AAA:1m": 99 });
    const result = await computeMovers({
      universe: ["AAA"],
      period: "1w",
      direction: "gainers",
      limit: 5,
      cache,
      fetchReturn: async () => 4,
    });

    expect(result.ranked).toEqual([{ ticker: "AAA", change: 4 }]);
    expect(cache.store.get("AAA:1w")).toBe(4);
  });

  it("skips tickers already known to have no data", async () => {
    const cache = makeCache({ "DEAD:1w": null });
    const fetchReturn = vi.fn(async () => 5);

    const result = await computeMovers({
      universe: ["DEAD", "LIVE"],
      period: "1w",
      direction: "gainers",
      limit: 5,
      cache,
      fetchReturn,
    });

    expect(fetchReturn).toHaveBeenCalledTimes(1);
    expect(fetchReturn).toHaveBeenCalledWith("LIVE", "1w");
    expect(result.ranked).toEqual([{ ticker: "LIVE", change: 5 }]);
    expect(result.complete).toBe(true);
  });

  it("caches a delisted ticker as dead so the next pass doesn't retry it", async () => {
    const cache = makeCache();
    await computeMovers({
      universe: ["GONE"],
      period: "1w",
      direction: "gainers",
      limit: 5,
      cache,
      fetchReturn: async () => {
        throw new Error("No data found, symbol may be delisted");
      },
    });

    expect(cache.store.get("GONE:1w")).toBeNull();
  });

  it("stops at the time budget and reports the result as incomplete", async () => {
    const cache = makeCache();
    let clock = 0;
    const result = await computeMovers({
      universe: ["A", "B", "C", "D", "E", "F"],
      period: "1w",
      direction: "gainers",
      limit: 5,
      cache,
      concurrency: 2,
      budgetMs: 25,
      now: () => clock,
      fetchReturn: async (t) => {
        clock += 10; // each batch of 2 costs 10ms of budget
        return t.charCodeAt(0);
      },
    });

    expect(result.complete).toBe(false);
    expect(result.covered).toBeLessThan(6);
    expect(result.ranked.length).toBeGreaterThan(0);
  });

  it("resumes from the cache on the next pass and then reports complete", async () => {
    const cache = makeCache();
    const universe = ["A", "B", "C", "D"];
    let clock = 0;
    const args = {
      universe,
      period: "1w" as const,
      direction: "gainers" as const,
      limit: 5,
      cache,
      concurrency: 2,
      budgetMs: 15,
      now: () => clock,
      fetchReturn: async (t: string) => {
        clock += 10;
        return t.charCodeAt(0);
      },
    };

    const first = await computeMovers(args);
    expect(first.complete).toBe(false);

    clock = 0;
    const second = await computeMovers(args);
    expect(second.complete).toBe(true);
    expect(second.ranked).toHaveLength(4);
  });

  it("never exceeds the requested concurrency", async () => {
    const cache = makeCache();
    let inFlight = 0;
    let peak = 0;

    await computeMovers({
      universe: Array.from({ length: 20 }, (_, i) => `T${i}`),
      period: "1w",
      direction: "gainers",
      limit: 5,
      cache,
      concurrency: 4,
      fetchReturn: async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return 1;
      },
    });

    expect(peak).toBeLessThanOrEqual(4);
  });

  it("ranks losers worst-first", async () => {
    const cache = makeCache({ "A:1m": -20, "B:1m": 5, "C:1m": -3 });
    const result = await computeMovers({
      universe: ["A", "B", "C"],
      period: "1m",
      direction: "losers",
      limit: 2,
      cache,
      fetchReturn: async () => 0,
    });

    expect(result.ranked).toEqual([
      { ticker: "A", change: -20 },
      { ticker: "C", change: -3 },
    ]);
  });
});
