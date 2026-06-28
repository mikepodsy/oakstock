"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// A user-drawn horizontal level on a price chart.
export interface HorizontalLine {
  id: string;
  price: number;
}

// One endpoint of a trendline: a chart time (unix seconds) and a price.
export interface TrendPoint {
  time: number;
  price: number;
}

// A user-drawn diagonal trendline connecting two points.
export interface Trendline {
  id: string;
  p1: TrendPoint;
  p2: TrendPoint;
}

interface DrawingStore {
  // Drawings are keyed by ticker so each symbol keeps its own set.
  lines: Record<string, HorizontalLine[]>;
  trendlines: Record<string, Trendline[]>;

  addLine: (ticker: string, price: number) => void;
  moveLine: (ticker: string, id: string, price: number) => void;
  removeLine: (ticker: string, id: string) => void;
  clearLines: (ticker: string) => void;

  addTrendline: (ticker: string, p1: TrendPoint, p2: TrendPoint) => void;
  moveTrendline: (
    ticker: string,
    id: string,
    p1: TrendPoint,
    p2: TrendPoint
  ) => void;
  removeTrendline: (ticker: string, id: string) => void;
  clearTrendlines: (ticker: string) => void;

  // Remove every drawing (lines + trendlines) for a ticker.
  clearAll: (ticker: string) => void;
}

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useDrawingStore = create<DrawingStore>()(
  persist(
    (set) => ({
      lines: {},
      trendlines: {},

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

      clearLines: (ticker) =>
        set((s) => ({ lines: { ...s.lines, [ticker]: [] } })),

      addTrendline: (ticker, p1, p2) =>
        set((s) => ({
          trendlines: {
            ...s.trendlines,
            [ticker]: [
              ...(s.trendlines[ticker] ?? []),
              { id: newId(), p1, p2 },
            ],
          },
        })),

      moveTrendline: (ticker, id, p1, p2) =>
        set((s) => ({
          trendlines: {
            ...s.trendlines,
            [ticker]: (s.trendlines[ticker] ?? []).map((t) =>
              t.id === id ? { ...t, p1, p2 } : t
            ),
          },
        })),

      removeTrendline: (ticker, id) =>
        set((s) => ({
          trendlines: {
            ...s.trendlines,
            [ticker]: (s.trendlines[ticker] ?? []).filter((t) => t.id !== id),
          },
        })),

      clearTrendlines: (ticker) =>
        set((s) => ({ trendlines: { ...s.trendlines, [ticker]: [] } })),

      clearAll: (ticker) =>
        set((s) => ({
          lines: { ...s.lines, [ticker]: [] },
          trendlines: { ...s.trendlines, [ticker]: [] },
        })),
    }),
    { name: "oakstock-drawings" }
  )
);
