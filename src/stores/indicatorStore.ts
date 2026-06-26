"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_INDICATORS,
  type IndicatorState,
  type MultiLineId,
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
        set(
          (s) =>
            ({
              [id]: { ...s[id], periods: s[id].periods.filter((p) => p !== period) },
            }) as Partial<IndicatorStore>
        ),
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
        sessions: s.sessions,
      }),
    }
  )
);
