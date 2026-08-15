"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IndicatorId } from "@/utils/indicatorConfig";

// Starred indicators, shown at the top of the picker's sidebar.
//
// Deliberately its own store rather than part of IndicatorState: which
// indicators are *applied* is per-chart (and per-dashboard-tile), but which
// ones you care about is a property of you, shared across every chart.
interface IndicatorFavoritesStore {
  favorites: IndicatorId[];
  toggleFavorite: (id: IndicatorId) => void;
  isFavorite: (id: IndicatorId) => boolean;
}

export const useIndicatorFavoritesStore = create<IndicatorFavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],

      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),

      isFavorite: (id) => get().favorites.includes(id),
    }),
    {
      name: "oakstock-indicator-favorites",
      partialize: (s) => ({ favorites: s.favorites }),
    }
  )
);
