// The list metadata behind the indicator picker: display names, which sidebar
// category an indicator lives under, and the aliases search should match.
//
// One entry per indicator in IndicatorState — indicatorCatalog.test.ts enforces
// that, so a new indicator can't be added to the chart without showing up in
// the picker.

import type { IndicatorId, IndicatorState } from "./indicatorConfig";

export type IndicatorCategory = "overlays" | "volume" | "oscillators";

export interface CatalogEntry {
  id: IndicatorId;
  label: string;
  category: IndicatorCategory;
  // Extra search terms — abbreviations and the names used elsewhere in the
  // industry, so "bb" or "bands" both find Bollinger Bands.
  keywords: string[];
  // Shown, but not selectable, outside intraday intervals.
  intradayOnly?: boolean;
  // A one-line description under the name in the list.
  blurb?: string;
}

export const INDICATOR_CATEGORIES: {
  id: IndicatorCategory;
  label: string;
}[] = [
  { id: "overlays", label: "Overlays" },
  { id: "volume", label: "Volume" },
  { id: "oscillators", label: "Oscillators" },
];

export const INDICATOR_CATALOG: CatalogEntry[] = [
  {
    id: "sma",
    label: "SMA",
    category: "overlays",
    keywords: ["simple", "moving", "average", "ma"],
    blurb: "Simple moving average",
  },
  {
    id: "ema",
    label: "EMA",
    category: "overlays",
    keywords: ["exponential", "moving", "average", "ma"],
    blurb: "Exponential moving average",
  },
  {
    id: "bollinger",
    label: "Bollinger Bands",
    category: "overlays",
    keywords: ["bb", "bands", "volatility", "stddev"],
    blurb: "Moving average with standard-deviation bands",
  },
  {
    id: "donchian",
    label: "Donchian Channels",
    category: "overlays",
    keywords: ["dc", "channels", "breakout", "high", "low"],
    blurb: "Highest high and lowest low over a window",
  },
  {
    id: "vwap",
    label: "VWAP",
    category: "overlays",
    keywords: ["volume", "weighted", "average", "price"],
    blurb: "Volume-weighted average price",
  },
  {
    id: "sessions",
    label: "Trading Sessions",
    category: "overlays",
    keywords: ["premarket", "after", "hours", "regular", "shading"],
    intradayOnly: true,
    blurb: "Shades pre-market, regular and after hours",
  },
  {
    id: "volume",
    label: "Volume",
    category: "volume",
    keywords: ["bars", "turnover"],
    blurb: "Traded volume per bar",
  },
  {
    id: "volumeProfile",
    label: "Volume Profile",
    category: "volume",
    keywords: ["vp", "value", "area", "poc", "histogram"],
    blurb: "Volume by price over the visible range",
  },
  {
    id: "rsi",
    label: "RSI",
    category: "oscillators",
    keywords: ["relative", "strength", "index", "momentum"],
    blurb: "Relative strength index, in its own pane",
  },
];

// Display name by id, for the legend's settings popover heading.
export const INDICATOR_LABELS = Object.fromEntries(
  INDICATOR_CATALOG.map((e) => [e.id, e.label])
) as Record<IndicatorId, string>;

// Case-insensitive match on the name and its aliases.
export function matchesQuery(entry: CatalogEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    entry.label.toLowerCase().includes(q) ||
    entry.keywords.some((k) => k.includes(q))
  );
}

// Active-indicator count for the trigger button's badge. Sessions only counts
// on intraday intervals, where it actually draws.
export function countActive(s: IndicatorState, isIntraday: boolean): number {
  return INDICATOR_CATALOG.filter(
    (e) => s[e.id]?.enabled && (!e.intradayOnly || isIntraday)
  ).length;
}
