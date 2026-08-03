"use client";

// Lets a chart draw its style/indicator config from somewhere other than the
// global persisted stores.
//
// The stock page and watchlist detail render <CandlestickChart> with no
// provider above it, so `useChartStyle`/`useIndicators` fall through to the
// global stores and behave exactly as before. Dashboard tiles wrap each chart
// in <ChartConfigProvider>, giving every tile its own colors and indicators.
//
// Both hooks mirror the zustand hook signature — `useChartStyle((s) => s.bar)`
// works the same as `useChartStyleStore((s) => s.bar)` — so consumers only
// change the hook name, not the call shape.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  useChartStyleStore,
  setBackground,
  setBarColor,
  setColor,
  setLineColor,
  setOpacity,
  resetStyle,
  toggleVisible,
  type ChartStyleState,
  type ChartStyleStore,
} from "@/stores/chartStyleStore";
import { useIndicatorStore, type IndicatorStore } from "@/stores/indicatorStore";
import {
  addPeriod,
  removePeriod,
  setIndicatorLineColor,
  setIndicatorParam,
  setPeriodColor,
  setVpRows,
  setVwapAnchor,
  toggleIndicator,
  toggleVpValueArea,
  type IndicatorState,
} from "@/utils/indicatorConfig";

interface ChartConfigValue {
  style: ChartStyleStore;
  indicators: IndicatorStore;
}

const ChartConfigContext = createContext<ChartConfigValue | null>(null);

export interface ChartConfigProviderProps {
  style: ChartStyleState;
  indicators: IndicatorState;
  onStyleChange: (next: ChartStyleState) => void;
  onIndicatorsChange: (next: IndicatorState) => void;
  children: ReactNode;
}

/**
 * Supplies one chart with its own style + indicator config. Both `style` and
 * `indicators` are controlled: edits are reported through the change handlers
 * rather than held here, so the owner (the dashboard layout store) stays the
 * single source of truth.
 */
export function ChartConfigProvider({
  style,
  indicators,
  onStyleChange,
  onIndicatorsChange,
  children,
}: ChartConfigProviderProps) {
  // Actions delegate to the same pure reducers the global stores use, so a tile
  // chart and a stock-page chart can never drift apart.
  const value = useMemo<ChartConfigValue>(
    () => ({
      style: {
        ...style,
        setColor: (group, side, hex) => onStyleChange(setColor(style, group, side, hex)),
        setBarColor: (side, hex) => onStyleChange(setBarColor(style, side, hex)),
        setLineColor: (hex) => onStyleChange(setLineColor(style, hex)),
        toggleVisible: (group) => onStyleChange(toggleVisible(style, group)),
        setBackground: (hex) => onStyleChange(setBackground(style, hex)),
        setOpacity: (which, v) => onStyleChange(setOpacity(style, which, v)),
        reset: () => onStyleChange(resetStyle()),
      },
      indicators: {
        ...indicators,
        toggle: (id) => onIndicatorsChange(toggleIndicator(indicators, id)),
        setParam: (id, key, v) => onIndicatorsChange(setIndicatorParam(indicators, id, key, v)),
        addPeriod: (id, p) => onIndicatorsChange(addPeriod(indicators, id, p)),
        removePeriod: (id, p) => onIndicatorsChange(removePeriod(indicators, id, p)),
        setLineColor: (id, hex) => onIndicatorsChange(setIndicatorLineColor(indicators, id, hex)),
        setPeriodColor: (id, p, hex) => onIndicatorsChange(setPeriodColor(indicators, id, p, hex)),
        setVwapAnchor: (anchor) => onIndicatorsChange(setVwapAnchor(indicators, anchor)),
        setVpRows: (rows) => onIndicatorsChange(setVpRows(indicators, rows)),
        toggleVpValueArea: () => onIndicatorsChange(toggleVpValueArea(indicators)),
      },
    }),
    [style, indicators, onStyleChange, onIndicatorsChange]
  );

  return <ChartConfigContext.Provider value={value}>{children}</ChartConfigContext.Provider>;
}

const identity = <S,>(s: S) => s;

/**
 * Candle/background style for the surrounding chart: the tile's own config when
 * inside a <ChartConfigProvider>, otherwise the global persisted store.
 */
export function useChartStyle(): ChartStyleStore;
export function useChartStyle<T>(selector: (s: ChartStyleStore) => T): T;
export function useChartStyle<T>(selector?: (s: ChartStyleStore) => T) {
  const ctx = useContext(ChartConfigContext);
  const sel = selector ?? (identity as (s: ChartStyleStore) => T);
  // Subscribed unconditionally to keep hook order stable; the result is
  // discarded when a provider is supplying config.
  const fromStore = useChartStyleStore(sel);
  return ctx ? sel(ctx.style) : fromStore;
}

/**
 * Indicator config for the surrounding chart: the tile's own config when inside
 * a <ChartConfigProvider>, otherwise the global persisted store.
 */
export function useIndicators(): IndicatorStore;
export function useIndicators<T>(selector: (s: IndicatorStore) => T): T;
export function useIndicators<T>(selector?: (s: IndicatorStore) => T) {
  const ctx = useContext(ChartConfigContext);
  const sel = selector ?? (identity as (s: IndicatorStore) => T);
  const fromStore = useIndicatorStore(sel);
  return ctx ? sel(ctx.indicators) : fromStore;
}
