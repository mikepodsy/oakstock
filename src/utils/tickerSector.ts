// Static ticker -> sector/category lookup for the ticker hover card. Stocks
// resolve to a GICS-style sector (the leading keys of RADAR_SECTORS; the rest —
// AI, growth, fintech, … — are themes, not sectors). ETFs resolve to their
// RADAR category label. Gaps are filled lazily from /api/quote at hover time.

import { RADAR_SECTORS, RADAR_ETF_CATEGORIES } from "@/utils/constants";

const GICS_SECTOR_KEYS = [
  "energy",
  "information_technology",
  "financials",
  "health_care",
  "consumer_discretionary",
  "consumer_staples",
  "industrials",
  "materials",
  "utilities",
  "real_estate",
  "communication_services",
] as const;

// Normalize away separator differences (e.g. RADAR's "BRK.B" vs the universe's
// "BRK-B") so both forms hit the same entry.
const norm = (ticker: string): string => ticker.toUpperCase().replace(/[.\-]/g, "");

const SECTOR_BY_TICKER: Map<string, string> = (() => {
  const map = new Map<string, string>();
  // Stocks first: canonical GICS sector, first match wins.
  for (const key of GICS_SECTOR_KEYS) {
    const cat = RADAR_SECTORS[key];
    if (!cat) continue;
    for (const ticker of cat.tickers) {
      const k = norm(ticker);
      if (!map.has(k)) map.set(k, cat.label);
    }
  }
  // ETFs: category label acts as the sector. Never overwrite a stock match.
  for (const cat of Object.values(RADAR_ETF_CATEGORIES)) {
    for (const ticker of cat.tickers) {
      const k = norm(ticker);
      if (!map.has(k)) map.set(k, cat.label);
    }
  }
  return map;
})();

/** Sector/category label for a ticker from the in-bundle maps, or null if unknown. */
export function staticSector(ticker: string): string | null {
  return SECTOR_BY_TICKER.get(norm(ticker)) ?? null;
}
