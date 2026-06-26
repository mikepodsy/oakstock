// Shared shape, defaults, colours and bounds for the chart indicators. Used by
// both the persisted store (src/stores/indicatorStore.ts), the menu
// (IndicatorsMenu.tsx) and the chart renderer (CandlestickChart.tsx) so the
// three stay in sync.

export interface IndicatorState {
  sma: { enabled: boolean; periods: number[] };
  ema: { enabled: boolean; periods: number[] };
  bollinger: { enabled: boolean; period: number; mult: number };
  donchian: { enabled: boolean; period: number };
  rsi: { enabled: boolean; period: number };
  volume: { enabled: boolean };
  sessions: { enabled: boolean };
}

// Ids whose `periods` array can hold several simultaneous lines.
export type MultiLineId = "sma" | "ema";

export const DEFAULT_INDICATORS: IndicatorState = {
  sma: { enabled: false, periods: [20, 50] },
  ema: { enabled: false, periods: [12, 26] },
  bollinger: { enabled: false, period: 20, mult: 2 },
  donchian: { enabled: false, period: 20 },
  rsi: { enabled: false, period: 14 },
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
