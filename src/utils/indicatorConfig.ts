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
  // `session` VWAP resets each trading day (intraday convention); `rolling` is a
  // trailing N-bar VWAP, which is what makes it useful on daily/weekly candles.
  vwap: {
    enabled: boolean;
    anchor: "session" | "rolling";
    period: number;
    color: string;
  };
  volume: { enabled: boolean };
  volumeProfile: { enabled: boolean; rows: number; showValueArea: boolean };
  sessions: { enabled: boolean };
}

// Indicators carrying a single configurable line color and a `period` input.
// (Not every member has `mult` — `setIndicatorParam` has always been loose here,
// and the menu only offers the inputs each indicator actually uses.)
export type SingleColorId = "bollinger" | "donchian" | "rsi" | "vwap";

// Ids whose `periods` array can hold several simultaneous lines.
export type MultiLineId = "sma" | "ema";

export const DEFAULT_INDICATORS: IndicatorState = {
  sma: { enabled: false, periods: [20, 50], colors: {} },
  ema: { enabled: false, periods: [12, 26], colors: {} },
  bollinger: { enabled: false, period: 20, mult: 2, color: "#60a5fa" },
  donchian: { enabled: false, period: 20, color: "#f59e0b" },
  rsi: { enabled: false, period: 14, color: "#a855f7" },
  vwap: { enabled: false, anchor: "session", period: 20, color: "#22d3ee" },
  volume: { enabled: true },
  volumeProfile: { enabled: false, rows: 300, showValueArea: true },
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
  vwap: "#22d3ee",
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
  rows: { min: 10, max: 1000, step: 10 },
};

export function maColor(index: number): string {
  return MA_PALETTE[index % MA_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Pure reducers over IndicatorState.
//
// These hold the only copy of the mutation logic. The global persisted store
// (src/stores/indicatorStore.ts) wraps each in `set()`, and the per-tile
// dashboard config (ChartConfigContext) applies the same functions to a tile's
// own state — so a chart on the dashboard and a chart on a stock page behave
// identically without the logic being written twice.
// ---------------------------------------------------------------------------

export function toggleIndicator(
  s: IndicatorState,
  id: keyof IndicatorState
): IndicatorState {
  return { ...s, [id]: { ...s[id], enabled: !s[id].enabled } };
}

export function setIndicatorParam(
  s: IndicatorState,
  id: SingleColorId,
  key: "period" | "mult",
  value: number
): IndicatorState {
  return { ...s, [id]: { ...s[id], [key]: value } };
}

// Rejects non-numeric, sub-1 and duplicate lengths so the menu can pass raw
// input straight through. Kept sorted so the rendered legend is stable.
export function addPeriod(
  s: IndicatorState,
  id: MultiLineId,
  period: number
): IndicatorState {
  const cur = s[id];
  if (!Number.isFinite(period) || period < 1 || cur.periods.includes(period)) {
    return s;
  }
  return {
    ...s,
    [id]: { ...cur, periods: [...cur.periods, period].sort((a, b) => a - b) },
  };
}

// Drops the length's custom color too, so re-adding it later picks up the
// auto-cycled palette rather than a stale override.
export function removePeriod(
  s: IndicatorState,
  id: MultiLineId,
  period: number
): IndicatorState {
  const colors = { ...(s[id].colors ?? {}) };
  delete colors[period];
  return {
    ...s,
    [id]: {
      ...s[id],
      periods: s[id].periods.filter((p) => p !== period),
      colors,
    },
  };
}

export function setIndicatorLineColor(
  s: IndicatorState,
  id: SingleColorId,
  hex: string
): IndicatorState {
  return { ...s, [id]: { ...s[id], color: hex } };
}

export function setPeriodColor(
  s: IndicatorState,
  id: MultiLineId,
  period: number,
  hex: string
): IndicatorState {
  return {
    ...s,
    [id]: { ...s[id], colors: { ...(s[id].colors ?? {}), [period]: hex } },
  };
}

export function setVwapAnchor(
  s: IndicatorState,
  anchor: "session" | "rolling"
): IndicatorState {
  return { ...s, vwap: { ...s.vwap, anchor } };
}

export function setVpRows(s: IndicatorState, rows: number): IndicatorState {
  if (!Number.isFinite(rows) || rows < 1) return s;
  return { ...s, volumeProfile: { ...s.volumeProfile, rows } };
}

export function toggleVpValueArea(s: IndicatorState): IndicatorState {
  return {
    ...s,
    volumeProfile: {
      ...s.volumeProfile,
      showValueArea: !s.volumeProfile.showValueArea,
    },
  };
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
