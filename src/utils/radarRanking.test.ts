import { describe, it, expect } from "vitest";
import { radarSourceMode, rankReturns } from "./radarRanking";
import { RADAR_ALL_KEY, RADAR_SECTORS } from "./constants";

describe("radarSourceMode", () => {
  it("uses Yahoo's market-wide day screener for All Companies gainers on Today", () => {
    const mode = radarSourceMode({
      sector: RADAR_ALL_KEY,
      ranking: "gainers",
      timeframe: "1d",
    });
    expect(mode).toEqual({ kind: "screener", screener: "day_gainers" });
  });

  it("uses the day_losers screener for All Companies losers on Today", () => {
    const mode = radarSourceMode({
      sector: RADAR_ALL_KEY,
      ranking: "losers",
      timeframe: "1d",
    });
    expect(mode).toEqual({ kind: "screener", screener: "day_losers" });
  });

  // The bug: the day screener only ranks by *today's* move, so using it for a
  // weekly/monthly view showed today's movers, not the period's best performers.
  it("does NOT use the day screener for All Companies gainers on a weekly view", () => {
    const mode = radarSourceMode({
      sector: RADAR_ALL_KEY,
      ranking: "gainers",
      timeframe: "1w",
    });
    expect(mode).toEqual({
      kind: "movers",
      sector: RADAR_ALL_KEY,
      direction: "gainers",
      period: "1w",
    });
  });

  it.each(["1m", "3m", "ytd", "1y"])(
    "ranks by true period return for the %s timeframe",
    (timeframe) => {
      const mode = radarSourceMode({
        sector: RADAR_ALL_KEY,
        ranking: "gainers",
        timeframe,
      });
      expect(mode.kind).toBe("movers");
    }
  );

  it("ranks a single sector by true period return on a monthly view", () => {
    const mode = radarSourceMode({
      sector: "energy",
      ranking: "losers",
      timeframe: "1m",
    });
    expect(mode).toEqual({
      kind: "movers",
      sector: "energy",
      direction: "losers",
      period: "1m",
    });
  });

  it("keeps a single sector on its static list for Today (page sorts on day change)", () => {
    const mode = radarSourceMode({
      sector: "energy",
      ranking: "gainers",
      timeframe: "1d",
    });
    expect(mode).toEqual({ kind: "static", sector: "energy", cap: null });
  });

  it("stays market-wide for trending regardless of timeframe", () => {
    for (const timeframe of ["1d", "1w", "1y"]) {
      expect(
        radarSourceMode({ sector: "energy", ranking: "trending", timeframe })
      ).toEqual({ kind: "trending" });
    }
  });

  it("caps the unranked All Companies list so it doesn't render ~2,000 cards", () => {
    const mode = radarSourceMode({
      sector: RADAR_ALL_KEY,
      ranking: "default",
      timeframe: "1d",
    });
    expect(mode).toEqual({ kind: "static", sector: RADAR_ALL_KEY, cap: 100 });
  });
});

describe("rankReturns", () => {
  const returns = { AAA: 5, BBB: -3, CCC: 12, DDD: -8, EEE: 0.5 };

  it("orders gainers by highest period return first", () => {
    expect(rankReturns(returns, "gainers", 3)).toEqual([
      { ticker: "CCC", change: 12 },
      { ticker: "AAA", change: 5 },
      { ticker: "EEE", change: 0.5 },
    ]);
  });

  it("orders losers by lowest period return first", () => {
    expect(rankReturns(returns, "losers", 2)).toEqual([
      { ticker: "DDD", change: -8 },
      { ticker: "BBB", change: -3 },
    ]);
  });

  it("drops tickers with no return rather than ranking them as zero", () => {
    const ranked = rankReturns({ AAA: 5, BBB: null, CCC: -2 }, "gainers", 10);
    expect(ranked.map((r) => r.ticker)).toEqual(["AAA", "CCC"]);
  });

  it("returns an empty list when nothing has a return yet", () => {
    expect(rankReturns({ AAA: null }, "gainers", 10)).toEqual([]);
  });
});

describe("radar sector universes", () => {
  it("resolves All Companies to the deduped union of every sector", () => {
    const all = RADAR_SECTORS[RADAR_ALL_KEY].tickers;
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThan(1000);
  });
});
