// Turns indicator config into the rows shown in the chart's on-chart legend.
//
// Kept pure and separate from the renderer so the ordering, labels and colors
// are testable, and so CandlestickChart.tsx doesn't grow another 60 lines of
// list building. The renderer resolves what to *draw* from the same config, so
// any change here needs the matching change there (see the `visible*` derived
// values in CandlestickChart).

import {
  INDICATOR_COLORS,
  hiddenKey,
  isHidden,
  maColorFor,
  type IndicatorId,
  type IndicatorState,
} from "./indicatorConfig";

export interface LegendRow {
  // Visibility key — also the React key. Unique across rows.
  key: string;
  // Which indicator's settings the row's gear opens.
  id: IndicatorId;
  // Set on SMA/EMA rows only, so the row's × removes just that length.
  period?: number;
  label: string;
  color: string;
  dashed?: boolean;
  hidden: boolean;
  // Sub-pane indicators are drawn outside the price pane; the legend notes it
  // so a muted RSI reads as "still there, in its own pane" rather than missing.
  pane?: "sub";
}

export function buildLegendRows(s: IndicatorState): LegendRow[] {
  const rows: LegendRow[] = [];

  const push = (
    id: IndicatorId,
    label: string,
    color: string,
    extra?: Partial<LegendRow>
  ) => {
    const key = hiddenKey(id, extra?.period);
    rows.push({ key, id, label, color, hidden: isHidden(s, key), ...extra });
  };

  // Moving averages: one row per length. The palette index is the length's
  // position in the full list, so hiding one line never recolors the others.
  for (const id of ["sma", "ema"] as const) {
    const cfg = s[id];
    if (!cfg.enabled) continue;
    cfg.periods.forEach((p, idx) =>
      push(id, `${id.toUpperCase()} ${p}`, maColorFor(cfg.colors, p, idx), {
        period: p,
        dashed: id === "ema",
      })
    );
  }

  if (s.bollinger.enabled) {
    push(
      "bollinger",
      `BB ${s.bollinger.period}, ${s.bollinger.mult}`,
      s.bollinger.color ?? INDICATOR_COLORS.bollinger
    );
  }

  if (s.donchian.enabled) {
    push(
      "donchian",
      `DC ${s.donchian.period}`,
      s.donchian.color ?? INDICATOR_COLORS.donchian
    );
  }

  // Session-anchored VWAP has no length to report — it restarts each day.
  if (s.vwap?.enabled) {
    push(
      "vwap",
      s.vwap.anchor === "session" ? "VWAP" : `VWAP ${s.vwap.period}`,
      s.vwap.color ?? INDICATOR_COLORS.vwap
    );
  }

  if (s.rsi.enabled) {
    push("rsi", `RSI ${s.rsi.period}`, s.rsi.color ?? INDICATOR_COLORS.rsi, {
      pane: "sub",
    });
  }

  if (s.volume.enabled) {
    push("volume", "Volume", VOLUME_SWATCH, { pane: "sub" });
  }

  if (s.volumeProfile.enabled) {
    push("volumeProfile", "Volume Profile", VOLUME_SWATCH);
  }

  // Trading sessions is background shading rather than a line: there is nothing
  // to distinguish in a legend, and muting it is just switching it off.

  return rows;
}

// Volume bars take their color from the candle style rather than the indicator
// config, so the legend uses a neutral swatch instead of guessing.
const VOLUME_SWATCH = "#94a3b8";
