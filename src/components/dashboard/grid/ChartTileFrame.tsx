"use client";

// Shared chrome around every dashboard chart: the drag handle (the header bar),
// the tile's controls, and the remove button.
//
// The header carries the `tile-drag-handle` class the grid targets, so dragging
// only starts there — the chart body keeps its own mouse handlers for crosshair,
// panning and drawing.

import { X } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import {
  useDashboardLayoutStore,
  type ChartTile,
} from "@/stores/dashboardLayoutStore";
import { TV_INTERVALS, tvLabelFor } from "@/utils/tvSymbols";
import { TradingViewTile } from "./TradingViewTile";
import { NativeChartTile } from "./NativeChartTile";
import { TileSettingsMenu } from "./TileSettingsMenu";

export function ChartTileFrame({ tile }: { tile: ChartTile }) {
  const removeTile = useDashboardLayoutStore((s) => s.removeTile);
  const updateTile = useDashboardLayoutStore((s) => s.updateTile);
  const theme = useThemeStore((s) => s.theme);

  const isTv = tile.kind === "tradingview";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-secondary">
      <div className="tile-drag-handle flex shrink-0 cursor-move items-center gap-2 border-b border-border-primary px-3 py-2">
        <span className="truncate text-sm font-medium text-text-primary">
          {isTv ? tvLabelFor(tile.symbol) : tile.symbol}
        </span>
        <span className="shrink-0 rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-tertiary">
          {isTv ? "TV" : "Questrade"}
        </span>

        {/* Interval lives here for TradingView tiles; native tiles have their own
            interval picker inside CandlestickChart's toolbar. */}
        {isTv && (
          <select
            value={tile.interval}
            onChange={(e) => updateTile(tile.id, { interval: e.target.value })}
            // Stop the drag handle from swallowing the click.
            onMouseDown={(e) => e.stopPropagation()}
            className="ml-auto shrink-0 cursor-pointer rounded border border-border-primary bg-bg-secondary px-1.5 py-0.5 text-xs text-text-primary"
          >
            {TV_INTERVALS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        )}

        <div className={isTv ? "flex shrink-0 items-center gap-1" : "ml-auto flex shrink-0 items-center gap-1"}>
          <TileSettingsMenu tile={tile} />
          <button
            type="button"
            onClick={() => removeTile(tile.id)}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={`Remove ${tile.symbol} chart`}
            title="Remove chart"
            className="cursor-pointer rounded p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-red-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Charts own their mouse events, so the body must never start a drag. */}
      <div className="min-h-0 flex-1 p-2" onMouseDown={(e) => e.stopPropagation()}>
        {isTv ? (
          // Remount on theme flip: the embed reads theme at construction time.
          <TradingViewTile key={theme} tile={tile} />
        ) : (
          <NativeChartTile tile={tile} />
        )}
      </div>
    </div>
  );
}
