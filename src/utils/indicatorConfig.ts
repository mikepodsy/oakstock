// Shared shape, defaults, colours and bounds for the chart indicators. Used by
// both the persisted store (src/stores/indicatorStore.ts), the menu
// (IndicatorsMenu.tsx) and the chart renderer (CandlestickChart.tsx) so the
// three stay in sync.

// SMA/EMA can hold several lengths; `colors` maps a length to its custom color.
// A length absent from the map falls back to the auto-cycled palette (maColor).
export interface IndicatorState {
  sma: { enabled: boolean; periods: number[]; colors: Record<number, string> };
  ema: { enabled: boolean; periods: number[]; colors: Record<number, string> };
  bollinger: { enabled: boolean; period: number; mult: number; color: string };
  donchian: { enabled: boolean; period: number; color: string };
  rsi: { enabled: boolean; period: number; color: string };
  volume: { enabled: boolean };
  sessions: { enabled: boolean };
}

// Indicators carrying a single configurable line color.
export type SingleColorId = "bollinger" | "donchian" | "rsi";

// Ids whose `periods` array can hold several simultaneous lines.
export type MultiLineId = "sma" | "ema";

export const DEFAULT_INDICATORS: IndicatorState = {
  sma: { enabled: false, periods: [20, 50], colors: {} },
  ema: { enabled: false, periods: [12, 26], colors: {} },
  bollinger: { enabled: false, period: 20, mult: 2, color: "#60a5fa" },
  donchian: { enabled: false, period: 20, color: "#f59e0b" },
  rsi: { enabled: false, period: 14, color: "#a855f7" },
  volume: { enabled: true },
  sessions: { enabled: false },
};

// Distinct colours cycled across the moving-average lines so combined SMAs/EMAs
// stay distinguishable. EMA lines are drawn dashed (see the renderer) using the
// same palette.
export const MA_PALETTE = [
  "#3b82f6", // blue
  "#a855f7", // purple
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#eab308", // yellow
];

export const INDICATOR_COLORS = {
  bollinger: "#60a5fa",
  donchian: "#f59e0b",
  rsi: "#a855f7",
};

// Low-opacity tints for intraday session shading.
export const SESSION_TINTS: Record<"pre" | "regular" | "after", string> = {
  pre: "rgba(59, 130, 246, 0.07)",
  regular: "rgba(34, 197, 94, 0.06)",
  after: "rgba(168, 85, 247, 0.07)",
};

export const PARAM_BOUNDS = {
  period: { min: 1, max: 400, step: 1 },
  mult: { min: 0.5, max: 5, step: 0.5 },
};

export function maColor(index: number): string {
  return MA_PALETTE[index % MA_PALETTE.length];
}

// Resolve the color for a moving-average length: the user's custom override if
// set, otherwise the auto-cycled palette color for its position. `colors` may be
// absent on state persisted before colors existed, so it's guarded.
export function maColorFor(
  colors: Record<number, string> | undefined,
  period: number,
  index: number
): string {
  return colors?.[period] ?? maColor(index);
}
