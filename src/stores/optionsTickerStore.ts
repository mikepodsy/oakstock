"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Remembers the last ticker viewed in the options module so navigating back to
// the Options tab (/options) returns to it instead of the search landing.
interface OptionsTickerStore {
  lastTicker: string | null;
  setLastTicker: (ticker: string) => void;
}

export const useOptionsTickerStore = create<OptionsTickerStore>()(
  persist(
    (set) => ({
      lastTicker: null,
      setLastTicker: (ticker) => set({ lastTicker: ticker.toUpperCase() }),
    }),
    { name: "oakstock-options-ticker" },
  ),
);
