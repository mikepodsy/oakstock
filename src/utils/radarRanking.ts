import {
  RADAR_ALL_KEY,
  RADAR_ALL_DEFAULT_CAP,
  type RadarRanking,
} from "./constants";

export type MoverDirection = "gainers" | "losers";

/**
 * Where the Radar's ticker list comes from for a given sector/ranking/timeframe.
 *
 * - `trending`  → Yahoo's market-wide trending list
 * - `screener`  → Yahoo's market-wide day_gainers/day_losers screen
 * - `movers`    → our own universe ranked by true return over the period
 * - `static`    → the sector's list as-is (the page sorts it locally)
 */
export type RadarSourceMode =
  | { kind: "trending" }
  | { kind: "screener"; screener: "day_gainers" | "day_losers" }
  | {
      kind: "movers";
      sector: string;
      direction: MoverDirection;
      period: string;
    }
  | { kind: "static"; sector: string; cap: number | null };

interface SourceInput {
  sector: string;
  ranking: RadarRanking;
  timeframe: string;
}

export const DAY_TIMEFRAME = "1d";

export function radarSourceMode({
  sector,
  ranking,
  timeframe,
}: SourceInput): RadarSourceMode {
  if (ranking === "trending") return { kind: "trending" };

  if (ranking === "gainers" || ranking === "losers") {
    // Yahoo's day screener ranks by *today's* move only, so it is the right
    // source for Today and the wrong one for every other timeframe. For those
    // we rank our own universe by its actual return over the period.
    if (timeframe !== DAY_TIMEFRAME) {
      return { kind: "movers", sector, direction: ranking, period: timeframe };
    }
    if (sector === RADAR_ALL_KEY) {
      return {
        kind: "screener",
        screener: ranking === "losers" ? "day_losers" : "day_gainers",
      };
    }
    // A single sector's list is small enough for the page to sort locally on
    // the live quote's day change.
    return { kind: "static", sector, cap: null };
  }

  return {
    kind: "static",
    sector,
    cap: sector === RADAR_ALL_KEY ? RADAR_ALL_DEFAULT_CAP : null,
  };
}

export interface RankedMover {
  ticker: string;
  change: number;
}

/**
 * Ranks tickers by period return, best first for gainers and worst first for
 * losers. Tickers without a return (delisted, or not fetched yet) are dropped
 * rather than treated as 0% — ranking them as flat would push real movers out
 * of the top N.
 */
export function rankReturns(
  returns: Record<string, number | null | undefined>,
  direction: MoverDirection,
  limit: number
): RankedMover[] {
  const ranked = Object.entries(returns)
    .filter(([, change]) => typeof change === "number" && Number.isFinite(change))
    .map(([ticker, change]) => ({ ticker, change: change as number }));

  ranked.sort((a, b) =>
    direction === "losers" ? a.change - b.change : b.change - a.change
  );

  return ranked.slice(0, limit);
}
