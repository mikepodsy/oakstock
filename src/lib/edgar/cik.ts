import { edgarCikCache } from "@/lib/cache";
import { fetchTickerCikMap } from "./client";

// Resolve a ticker to its 10-digit SEC CIK, or null if SEC doesn't list it
// (common for non-US companies and ADRs). The full directory is fetched once
// and cached for a day under a single key.
export async function getCik(ticker: string): Promise<string | null> {
  const key = "map";
  let map = edgarCikCache.get(key);
  if (map === undefined) {
    map = await fetchTickerCikMap();
    edgarCikCache.set(key, map); // cache null too, so a failed fetch isn't retried every request
  }
  return map?.[ticker.toUpperCase()] ?? null;
}
