"use client";

// Per-tile settings popover.
//
// Native tiles need almost nothing here — CandlestickChart already renders the
// full Indicators and Style menus in its own toolbar, and inside the tile's
// ChartConfigProvider those write to this tile's config. So this menu only
// covers what TradingView tiles can't express through that toolbar.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { ChartConfigProvider } from "@/components/charts/ChartConfigContext";
import { ChartStyleMenu } from "@/components/charts/ChartStyleMenu";
import {
  useDashboardLayoutStore,
  type ChartTile,
  type TileChartType,
} from "@/stores/dashboardLayoutStore";
import type { ChartStyleState } from "@/stores/chartStyleStore";
import {
  toggleIndicator,
  type IndicatorState,
} from "@/utils/indicatorConfig";
import { TV_SUPPORTED_INDICATORS } from "@/utils/tvSymbols";

const CHART_TYPES: { value: TileChartType; label: string }[] = [
  { value: "candles", label: "Candles" },
  { value: "bars", label: "Bars" },
  { value: "line", label: "Line" },
];

const INDICATOR_LABELS: Record<string, string> = {
  sma: "Moving average",
  ema: "Exponential MA",
  vwap: "VWAP",
  bollinger: "Bollinger Bands",
  rsi: "RSI",
  volume: "Volume",
};

export function TileSettingsMenu({ tile }: { tile: ChartTile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const updateTile = useDashboardLayoutStore((s) => s.updateTile);

  const onStyleChange = useCallback(
    (style: ChartStyleState) => updateTile(tile.id, { style }),
    [updateTile, tile.id]
  );
  const onIndicatorsChange = useCallback(
    (indicators: IndicatorState) => updateTile(tile.id, { indicators }),
    [updateTile, tile.id]
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isTv = tile.kind === "tradingview";

  return (
    <div ref={rootRef} className="relative" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Chart settings"
        title="Chart settings"
        className="cursor-pointer rounded p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-60 rounded-lg border border-border-primary bg-bg-elevated p-2 shadow-lg">
          <div className="px-1 pb-1 text-[10px] uppercase tracking-wide text-text-tertiary">
            Chart type
          </div>
          <div className="flex gap-1">
            {CHART_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => updateTile(tile.id, { chartType: t.value })}
                className={`flex-1 cursor-pointer rounded border px-2 py-1 text-xs transition-colors ${
                  tile.chartType === t.value
                    ? "border-green-primary text-text-primary"
                    : "border-border-primary text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isTv && (
            <>
              <div className="my-2 border-t border-border-primary" />
              <div className="px-1 pb-1 text-[10px] uppercase tracking-wide text-text-tertiary">
                Indicators
              </div>
              {TV_SUPPORTED_INDICATORS.map((id) => {
                const cfg = tile.indicators[id] as
                  | { enabled?: boolean }
                  | undefined;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      onIndicatorsChange(toggleIndicator(tile.indicators, id))
                    }
                    className="flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-left hover:bg-bg-tertiary"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        cfg?.enabled
                          ? "border-transparent bg-green-primary"
                          : "border-border-primary"
                      }`}
                    >
                      {cfg?.enabled && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="text-sm text-text-primary">
                      {INDICATOR_LABELS[id] ?? id}
                    </span>
                  </button>
                );
              })}
              <p className="mt-1 px-1 text-[10px] leading-snug text-text-tertiary">
                TradingView tiles support on/off only. Settings changed inside the
                chart itself aren&apos;t saved — use these controls to persist them.
              </p>

              <div className="my-2 border-t border-border-primary" />
              {/* The same style menu the stock page uses; the provider points it
                  at this tile's colors instead of the global store. */}
              <ChartConfigProvider
                style={tile.style}
                indicators={tile.indicators}
                onStyleChange={onStyleChange}
                onIndicatorsChange={onIndicatorsChange}
              >
                <ChartStyleMenu chartType={tile.chartType} />
              </ChartConfigProvider>
            </>
          )}
        </div>
      )}
    </div>
  );
}
