"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_INDICATORS,
  type IndicatorState,
  type MultiLineId,
  type SingleColorId,
} from "@/utils/indicatorConfig";

interface IndicatorStore extends IndicatorState {
  toggle: (id: keyof IndicatorState) => void;
  setParam: (
    id: "bollinger" | "donchian" | "rsi",
    key: "period" | "mult",
    value: number
  ) => void;
  addPeriod: (id: MultiLineId, period: number) => void;
  removePeriod: (id: MultiLineId, period: number) => void;
  // Color of a single-line indicator (Bollinger / Donchian / RSI).
  setLineColor: (id: SingleColorId, hex: string) => void;
  // Color of one SMA/EMA length.
  setPeriodColor: (id: MultiLineId, period: number, hex: string) => void;
  // Volume Profile settings.
  setVpRows: (rows: number) => void;
  toggleVpValueArea: () => void;
}

export const useIndicatorStore = create<IndicatorStore>()(
  persist(
    (set) => ({
      ...DEFAULT_INDICATORS,

      toggle: (id) =>
        set(
          (s) =>
            ({ [id]: { ...s[id], enabled: !s[id].enabled } }) as Partial<IndicatorStore>
        ),

      setParam: (id, key, value) =>
        set(
          (s) =>
            ({ [id]: { ...s[id], [key]: value } }) as Partial<IndicatorStore>
        ),

      addPeriod: (id, period) =>
        set((s) => {
          const cur = s[id];
          if (!Number.isFinite(period) || period < 1 || cur.periods.includes(period)) {
            return {} as Partial<IndicatorStore>;
          }
          return {
            [id]: { ...cur, periods: [...cur.periods, period].sort((a, b) => a - b) },
          } as Partial<IndicatorStore>;
        }),

      removePeriod: (id, period) =>
        set((s) => {
          const colors = { ...(s[id].colors ?? {}) };
          delete colors[period];
          return {
            [id]: {
              ...s[id],
              periods: s[id].periods.filter((p) => p !== period),
              colors,
            },
          } as Partial<IndicatorStore>;
        }),

      setLineColor: (id, hex) =>
        set((s) => ({ [id]: { ...s[id], color: hex } }) as Partial<IndicatorStore>),

      setPeriodColor: (id, period, hex) =>
        set(
          (s) =>
            ({
              [id]: { ...s[id], colors: { ...(s[id].colors ?? {}), [period]: hex } },
            }) as Partial<IndicatorStore>
        ),

      setVpRows: (rows) =>
        set((s) => {
          if (!Number.isFinite(rows) || rows < 1) return {} as Partial<IndicatorStore>;
          return { volumeProfile: { ...s.volumeProfile, rows } };
        }),

      toggleVpValueArea: () =>
        set((s) => ({
          volumeProfile: {
            ...s.volumeProfile,
            showValueArea: !s.volumeProfile.showValueArea,
          },
        })),
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
        volume: s.volume,
        volumeProfile: s.volumeProfile,
        sessions: s.sessions,
      }),
    }
  )
);
