"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// A user-drawn horizontal level on a price chart.
export interface HorizontalLine {
  id: string;
  price: number;
}

interface DrawingStore {
  // Lines are keyed by ticker so each symbol keeps its own set.
  lines: Record<string, HorizontalLine[]>;
  addLine: (ticker: string, price: number) => void;
  moveLine: (ticker: string, id: string, price: number) => void;
  removeLine: (ticker: string, id: string) => void;
}

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useDrawingStore = create<DrawingStore>()(
  persist(
    (set) => ({
      lines: {},

      addLine: (ticker, price) =>
        set((s) => ({
          lines: {
            ...s.lines,
            [ticker]: [...(s.lines[ticker] ?? []), { id: newId(), price }],
          },
        })),

      moveLine: (ticker, id, price) =>
        set((s) => ({
          lines: {
            ...s.lines,
            [ticker]: (s.lines[ticker] ?? []).map((l) =>
              l.id === id ? { ...l, price } : l
            ),
          },
        })),

      removeLine: (ticker, id) =>
        set((s) => ({
          lines: {
            ...s.lines,
            [ticker]: (s.lines[ticker] ?? []).filter((l) => l.id !== id),
          },
        })),
    }),
    { name: "oakstock-drawings" }
  )
);
