"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Per-side color group for one part of a candle (body / border / wick). Each is
// independently toggleable, mirroring TradingView's candle style controls.
export interface ColorGroup {
  up: string;
  down: string;
  visible: boolean;
}

export type ColorGroupId = "body" | "border" | "wick";

export interface ChartStyleState {
  body: ColorGroup;
  border: ColorGroup;
  wick: ColorGroup;
  background: string;
  candleUpOpacity: number; // 0..1 — alpha applied to the up candle body fill
  candleDownOpacity: number; // 0..1 — alpha applied to the down candle body fill
  backgroundOpacity: number; // 0..1 — alpha applied to the chart background
}

// Defaults: green/red on black. Borders are on by default in a darker shade of
// the body so candles have a visible, editable outline out of the box (matching
// the body color would make the border invisible / look like it never renders).
export const DEFAULT_CHART_STYLE: ChartStyleState = {
  body: { up: "#22C55E", down: "#EF4444", visible: true },
  border: { up: "#16A34A", down: "#DC2626", visible: true },
  wick: { up: "#22C55E", down: "#EF4444", visible: true },
  background: "#000000",
  candleUpOpacity: 1,
  candleDownOpacity: 1,
  backgroundOpacity: 1,
};

// Standard one-click swatches offered beside every color control.
export const SWATCHES = [
  "#22C55E",
  "#EF4444",
  "#3B82F6",
  "#F59E0B",
  "#A855F7",
  "#F0EDE8",
  "#000000",
];

// Convert a #rrggbb hex + 0..1 alpha into an rgba() string for lightweight-charts.
// Falls back to the raw input if the hex can't be parsed.
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

interface ChartStyleStore extends ChartStyleState {
  setColor: (group: ColorGroupId, side: "up" | "down", hex: string) => void;
  toggleVisible: (group: ColorGroupId) => void;
  setBackground: (hex: string) => void;
  setOpacity: (
    which: "candleUpOpacity" | "candleDownOpacity" | "backgroundOpacity",
    value: number
  ) => void;
  reset: () => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const useChartStyleStore = create<ChartStyleStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CHART_STYLE,

      setColor: (group, side, hex) =>
        set((s) => ({ [group]: { ...s[group], [side]: hex } }) as Partial<ChartStyleStore>),

      toggleVisible: (group) =>
        set(
          (s) =>
            ({ [group]: { ...s[group], visible: !s[group].visible } }) as Partial<ChartStyleStore>
        ),

      setBackground: (hex) => set({ background: hex }),

      setOpacity: (which, value) => set({ [which]: clamp01(value) } as Partial<ChartStyleStore>),

      reset: () => set({ ...DEFAULT_CHART_STYLE }),
    }),
    {
      name: "oakstock-chart-style",
      version: 2,
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== "object") {
          return persisted as ChartStyleState;
        }
        const p = persisted as Record<string, unknown>;
        // v0 had a single `candleOpacity`; carry it over to both up and down.
        if (version < 1) {
          const legacy = typeof p.candleOpacity === "number" ? p.candleOpacity : 1;
          p.candleUpOpacity = legacy;
          p.candleDownOpacity = legacy;
          delete p.candleOpacity;
        }
        // v1 hid borders behind body-matching colors, so editing them looked like
        // a no-op. Upgrade users still on that untouched default to the new
        // visible, distinct border; leave anyone who customized borders alone.
        if (version < 2) {
          const border = p.border as ColorGroup | undefined;
          if (
            border &&
            border.visible === false &&
            border.up === "#22C55E" &&
            border.down === "#EF4444"
          ) {
            p.border = { ...DEFAULT_CHART_STYLE.border };
          }
        }
        return persisted as ChartStyleState;
      },
      // Persist only the data, not the action functions.
      partialize: (s) => ({
        body: s.body,
        border: s.border,
        wick: s.wick,
        background: s.background,
        candleUpOpacity: s.candleUpOpacity,
        candleDownOpacity: s.candleDownOpacity,
        backgroundOpacity: s.backgroundOpacity,
      }),
    }
  )
);
