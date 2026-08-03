"use client";

// The in-app lightweight-charts renderer as a dashboard tile. Equities and ETFs
// only (Questrade's candle API), but in exchange it keeps everything the
// TradingView embed can't offer: drawing tools, volume profile, and fully
// parameterised indicators.
//
// ChartConfigProvider is what makes the tile's colors and indicators its own —
// without it, CandlestickChart falls through to the global persisted stores.

import { useCallback } from "react";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { ChartConfigProvider } from "@/components/charts/ChartConfigContext";
import {
  useDashboardLayoutStore,
  type ChartTile,
  type TileChartType,
} from "@/stores/dashboardLayoutStore";
import type { ChartStyleState } from "@/stores/chartStyleStore";
import type { IndicatorState } from "@/utils/indicatorConfig";

export function NativeChartTile({ tile }: { tile: ChartTile }) {
  const updateTile = useDashboardLayoutStore((s) => s.updateTile);

  // Stable identities so ChartConfigProvider's memo only recomputes on a real
  // config change, not on every parent render.
  const onStyleChange = useCallback(
    (style: ChartStyleState) => updateTile(tile.id, { style }),
    [updateTile, tile.id]
  );
  const onIndicatorsChange = useCallback(
    (indicators: IndicatorState) => updateTile(tile.id, { indicators }),
    [updateTile, tile.id]
  );
  const onIntervalChange = useCallback(
    (interval: string) => updateTile(tile.id, { interval }),
    [updateTile, tile.id]
  );
  const onChartTypeChange = useCallback(
    (chartType: TileChartType) => updateTile(tile.id, { chartType }),
    [updateTile, tile.id]
  );

  return (
    <ChartConfigProvider
      style={tile.style}
      indicators={tile.indicators}
      onStyleChange={onStyleChange}
      onIndicatorsChange={onIndicatorsChange}
    >
      <CandlestickChart
        ticker={tile.symbol}
        fillHeight
        hideHeading
        interval={tile.interval}
        onIntervalChange={onIntervalChange}
        chartType={tile.chartType}
        onChartTypeChange={onChartTypeChange}
      />
    </ChartConfigProvider>
  );
}
