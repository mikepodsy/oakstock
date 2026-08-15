"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_INDICATORS,
  addPeriod,
  removePeriod,
  setIndicatorLineColor,
  setIndicatorParam,
  setPeriodColor,
  setVpRows,
  setVwapAnchor,
  toggleHidden,
  toggleIndicator,
  toggleVpValueArea,
  type IndicatorId,
  type IndicatorState,
  type MultiLineId,
  type SingleColorId,
} from "@/utils/indicatorConfig";

// Exported so the dashboard's per-tile config (ChartConfigContext) can present
// an identically-shaped object and swap in for this store transparently.
export interface IndicatorStore extends IndicatorState {
  toggle: (id: IndicatorId) => void;
  // Mute one line without discarding its config — the legend's eye control.
  toggleHidden: (key: string) => void;
  setParam: (id: SingleColorId, key: "period" | "mult", value: number) => void;
  addPeriod: (id: MultiLineId, period: number) => void;
  removePeriod: (id: MultiLineId, period: number) => void;
  // Color of a single-line indicator (Bollinger / Donchian / RSI).
  setLineColor: (id: SingleColorId, hex: string) => void;
  // Color of one SMA/EMA length.
  setPeriodColor: (id: MultiLineId, period: number, hex: string) => void;
  // VWAP anchoring: reset each session, or a trailing N-bar window.
  setVwapAnchor: (anchor: "session" | "rolling") => void;
  // Volume Profile settings.
  setVpRows: (rows: number) => void;
  toggleVpValueArea: () => void;
}

export const useIndicatorStore = create<IndicatorStore>()(
  persist(
    (set) => ({
      ...DEFAULT_INDICATORS,

      // Every action delegates to the pure reducer in utils/indicatorConfig so
      // the dashboard's per-tile config can reuse the exact same logic.
      toggle: (id) => set((s) => toggleIndicator(s, id)),

      toggleHidden: (key) => set((s) => toggleHidden(s, key)),

      setParam: (id, key, value) => set((s) => setIndicatorParam(s, id, key, value)),

      addPeriod: (id, period) => set((s) => addPeriod(s, id, period)),

      removePeriod: (id, period) => set((s) => removePeriod(s, id, period)),

      setLineColor: (id, hex) => set((s) => setIndicatorLineColor(s, id, hex)),

      setPeriodColor: (id, period, hex) => set((s) => setPeriodColor(s, id, period, hex)),

      setVwapAnchor: (anchor) => set((s) => setVwapAnchor(s, anchor)),

      setVpRows: (rows) => set((s) => setVpRows(s, rows)),

      toggleVpValueArea: () => set((s) => toggleVpValueArea(s)),
    }),
    {
      name: "oakstock-indicators",
      // Persist only the data, not the action functions.
      partialize: (s) => ({
        sma: s.sma,
        ema: s.ema,
        bollinger: s.bollinger,
        donchian: s.donchian,
        rsi: s.rsi,
        vwap: s.vwap,
        volume: s.volume,
        volumeProfile: s.volumeProfile,
        sessions: s.sessions,
        hidden: s.hidden,
      }),
    }
  )
);
