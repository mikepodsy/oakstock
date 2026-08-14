"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Mirrors CandlestickChart's own (unexported) ChartType union. Kept structurally
// identical so it assigns straight into the chart's controlled prop.
export type ScannerChartType = "candles" | "bars" | "line";

export const MIN_PANEL_WIDTH = 220;
export const MAX_PANEL_WIDTH = 560;
export const DEFAULT_PANEL_WIDTH = 320;

export const DEFAULT_INTERVAL = "OneDay";
export const DEFAULT_CHART_TYPE: ScannerChartType = "candles";

interface ScannerStore {
  // Which watchlist the symbol panel is showing, and which of its symbols is
  // charted. Both are reconciled against the loaded watchlists on mount.
  activeWatchlistId: string | null;
  selectedTicker: string | null;
  // Panel geometry.
  panelWidth: number;
  panelCollapsed: boolean;
  // Chart settings live here (not inside CandlestickChart) so they survive
  // symbol swaps, navigation, and reloads.
  interval: string;
  chartType: ScannerChartType;

  setActiveWatchlistId: (id: string | null) => void;
  setSelectedTicker: (ticker: string | null) => void;
  setPanelWidth: (px: number) => void;
  togglePanel: () => void;
  setInterval: (interval: string) => void;
  setChartType: (chartType: ScannerChartType) => void;
}

function clampWidth(px: number): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(px)));
}

export const useScannerStore = create<ScannerStore>()(
  persist(
    (set) => ({
      activeWatchlistId: null,
      selectedTicker: null,
      panelWidth: DEFAULT_PANEL_WIDTH,
      panelCollapsed: false,
      interval: DEFAULT_INTERVAL,
      chartType: DEFAULT_CHART_TYPE,

      setActiveWatchlistId: (id) => set({ activeWatchlistId: id }),
      setSelectedTicker: (ticker) =>
        set({ selectedTicker: ticker ? ticker.toUpperCase() : null }),
      // Clamped in the setter so no caller can persist an unusable width.
      setPanelWidth: (px) => set({ panelWidth: clampWidth(px) }),
      togglePanel: () => set((s) => ({ panelCollapsed: !s.panelCollapsed })),
      setInterval: (interval) => set({ interval }),
      setChartType: (chartType) => set({ chartType }),
    }),
    {
      name: "oakstock-scanner",
      // Persist only the data, not the action functions.
      partialize: (s) => ({
        activeWatchlistId: s.activeWatchlistId,
        selectedTicker: s.selectedTicker,
        panelWidth: s.panelWidth,
        panelCollapsed: s.panelCollapsed,
        interval: s.interval,
        chartType: s.chartType,
      }),
    }
  )
);

/**
 * False until the persisted scanner prefs have been read from localStorage.
 *
 * The server renders the defaults while the browser has whatever the user last
 * saved (panel width, selected symbol, interval), so the workspace must wait for
 * this or React reports a hydration mismatch. Deliberately starts `false` even on
 * the client — the first client render has to match the server's.
 */
export function useScannerHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useScannerStore.persist.onFinishHydration(onChange),
    () => useScannerStore.persist.hasHydrated(),
    () => false
  );
}
