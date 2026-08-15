"use client";

// Named dashboard workspaces: each holds a set of chart tiles plus the
// react-grid-layout geometry describing how they're arranged. Persisted to
// localStorage following the same pattern as the other chart prefs stores
// (see chartStyleStore.ts / indicatorStore.ts).

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LayoutItem } from "react-grid-layout";
import {
  DEFAULT_CHART_STYLE,
  type ChartStyleState,
} from "@/stores/chartStyleStore";
import { DEFAULT_INDICATORS, type IndicatorState } from "@/utils/indicatorConfig";

/** `tradingview` = TradingView embed (TV supplies the data — futures, bonds, FX).
 *  `native` = the in-app lightweight-charts renderer on Questrade data. */
export type TileKind = "tradingview" | "native";

export type TileChartType = "candles" | "bars" | "line";

export interface ChartTile {
  id: string;
  kind: TileKind;
  /** TradingView-qualified for TV tiles ("COMEX:GC1!"), a plain ticker for native ("NVDA"). */
  symbol: string;
  /** Display label shown in the tile header. */
  label: string;
  /** TV interval code ("60", "D") for TV tiles; Questrade granularity ("OneHour") for native. */
  interval: string;
  chartType: TileChartType;
  /** Per-tile chart appearance, seeded from the global defaults on creation. */
  style: ChartStyleState;
  /** Per-tile indicator config, seeded from the global defaults on creation. */
  indicators: IndicatorState;
}

export interface DashboardLayout {
  id: string;
  name: string;
  tiles: ChartTile[];
  /** RGL geometry. `i` matches ChartTile.id. */
  grid: LayoutItem[];
}

const DEFAULT_TILE_SIZE = { w: 6, h: 9, minW: 3, minH: 5 } as const;

function newId(): string {
  // randomUUID needs a secure context; fall back for http:// dev hosts.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface NewTileInput {
  kind: TileKind;
  symbol: string;
  label?: string;
  interval?: string;
  chartType?: TileChartType;
}

/** Builds a tile with per-tile config cloned from the global defaults, so later
 *  edits to one tile never leak into another. */
export function createTile(input: NewTileInput): ChartTile {
  return {
    id: newId(),
    kind: input.kind,
    symbol: input.symbol,
    label: input.label ?? input.symbol,
    interval: input.interval ?? (input.kind === "tradingview" ? "D" : "OneDay"),
    chartType: input.chartType ?? "candles",
    style: structuredClone(DEFAULT_CHART_STYLE),
    indicators: structuredClone(DEFAULT_INDICATORS),
  };
}

/** Places a new tile below everything else; the vertical compactor pulls it up
 *  into the first gap that fits. */
function gridItemFor(id: string): LayoutItem {
  return { i: id, x: 0, y: Infinity, ...DEFAULT_TILE_SIZE };
}

function buildLayout(name: string, tiles: ChartTile[], cols = 2): DashboardLayout {
  return {
    id: newId(),
    name,
    tiles,
    grid: tiles.map((t, idx) => ({
      i: t.id,
      x: (idx % cols) * DEFAULT_TILE_SIZE.w,
      y: Math.floor(idx / cols) * DEFAULT_TILE_SIZE.h,
      ...DEFAULT_TILE_SIZE,
    })),
  };
}

/** Shipped so the grid is never empty on first load: the four broad-market
 *  benchmarks, charted through TradingView so index/ETF data is consistent. */
function defaultLayouts(): DashboardLayout[] {
  return [
    buildLayout("Macro", [
      createTile({ kind: "tradingview", symbol: "AMEX:SPY", label: "SPY", interval: "D" }),
      createTile({ kind: "tradingview", symbol: "NASDAQ:QQQ", label: "QQQ", interval: "D" }),
      createTile({ kind: "tradingview", symbol: "AMEX:GLD", label: "GLD (gold ETF)", interval: "D" }),
      createTile({ kind: "tradingview", symbol: "AMEX:DIA", label: "DIA (Dow Jones)", interval: "D" }),
    ]),
  ];
}

/** v1 shipped futures/rates/FX defaults; v2 replaced them with the broad-market
 *  ETFs above. Rewritten in place — same tile ids, so saved grid geometry, style
 *  and indicator tweaks all survive the swap. */
const V2_SYMBOL_SWAP: Record<string, { symbol: string; label: string }> = {
  "CME_MINI:ES1!": { symbol: "AMEX:SPY", label: "SPY" },
  "TVC:DXY": { symbol: "NASDAQ:QQQ", label: "QQQ" },
  "COMEX:GC1!": { symbol: "AMEX:GLD", label: "GLD (gold ETF)" },
  "CBOT:ZB1!": { symbol: "AMEX:DIA", label: "DIA (Dow Jones)" },
};

interface DashboardLayoutStore {
  layouts: DashboardLayout[];
  activeLayoutId: string;

  setActiveLayout: (id: string) => void;
  addLayout: (name: string) => void;
  renameLayout: (id: string, name: string) => void;
  duplicateLayout: (id: string) => void;
  deleteLayout: (id: string) => void;

  addTile: (input: NewTileInput) => void;
  removeTile: (tileId: string) => void;
  updateTile: (tileId: string, patch: Partial<Omit<ChartTile, "id">>) => void;
  setGrid: (grid: LayoutItem[]) => void;
}

/** Applies `fn` to the active layout, leaving the others untouched. */
function mapActive(
  s: DashboardLayoutStore,
  fn: (l: DashboardLayout) => DashboardLayout
): Pick<DashboardLayoutStore, "layouts"> {
  return {
    layouts: s.layouts.map((l) => (l.id === s.activeLayoutId ? fn(l) : l)),
  };
}

const initialLayouts = defaultLayouts();

export const useDashboardLayoutStore = create<DashboardLayoutStore>()(
  persist(
    (set) => ({
      layouts: initialLayouts,
      activeLayoutId: initialLayouts[0].id,

      setActiveLayout: (id) => set({ activeLayoutId: id }),

      addLayout: (name) =>
        set((s) => {
          const layout = buildLayout(name.trim() || "Untitled", []);
          return { layouts: [...s.layouts, layout], activeLayoutId: layout.id };
        }),

      renameLayout: (id, name) =>
        set((s) => ({
          layouts: s.layouts.map((l) =>
            l.id === id ? { ...l, name: name.trim() || l.name } : l
          ),
        })),

      duplicateLayout: (id) =>
        set((s) => {
          const src = s.layouts.find((l) => l.id === id);
          if (!src) return {};
          // Fresh tile ids, and the grid remapped onto them so geometry follows.
          const idMap = new Map(src.tiles.map((t) => [t.id, newId()]));
          const copy: DashboardLayout = {
            id: newId(),
            name: `${src.name} copy`,
            tiles: src.tiles.map((t) => ({
              ...structuredClone(t),
              id: idMap.get(t.id)!,
            })),
            grid: src.grid.flatMap((g) => {
              const mapped = idMap.get(g.i);
              return mapped ? [{ ...g, i: mapped }] : [];
            }),
          };
          return { layouts: [...s.layouts, copy], activeLayoutId: copy.id };
        }),

      // Deleting the last layout would leave nothing to render, so the final one
      // is kept and simply emptied instead.
      deleteLayout: (id) =>
        set((s) => {
          if (s.layouts.length <= 1) {
            return { layouts: [{ ...s.layouts[0], tiles: [], grid: [] }] };
          }
          const layouts = s.layouts.filter((l) => l.id !== id);
          return {
            layouts,
            activeLayoutId:
              s.activeLayoutId === id ? layouts[0].id : s.activeLayoutId,
          };
        }),

      addTile: (input) =>
        set((s) => {
          const tile = createTile(input);
          return mapActive(s, (l) => ({
            ...l,
            tiles: [...l.tiles, tile],
            grid: [...l.grid, gridItemFor(tile.id)],
          }));
        }),

      removeTile: (tileId) =>
        set((s) =>
          mapActive(s, (l) => ({
            ...l,
            tiles: l.tiles.filter((t) => t.id !== tileId),
            grid: l.grid.filter((g) => g.i !== tileId),
          }))
        ),

      updateTile: (tileId, patch) =>
        set((s) =>
          mapActive(s, (l) => ({
            ...l,
            tiles: l.tiles.map((t) => (t.id === tileId ? { ...t, ...patch } : t)),
          }))
        ),

      // RGL emits the full layout on every drag/resize commit.
      setGrid: (grid) => set((s) => mapActive(s, (l) => ({ ...l, grid }))),
    }),
    {
      name: "oakstock-dashboard-layouts",
      version: 2,
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== "object") {
          return persisted as DashboardLayoutStore;
        }
        const p = persisted as Partial<DashboardLayoutStore>;
        // Swap the retired v1 macro instruments wherever they were saved, not
        // just in the shipped "Macro" layout, so they're gone everywhere.
        if (version < 2 && p.layouts) {
          p.layouts = p.layouts.map((l) => ({
            ...l,
            tiles: l.tiles.map((t) => {
              const swap = t.kind === "tradingview" ? V2_SYMBOL_SWAP[t.symbol] : undefined;
              return swap ? { ...t, ...swap } : t;
            }),
          }));
        }
        return persisted as DashboardLayoutStore;
      },
      // Persist only the data, not the action functions.
      partialize: (s) => ({
        layouts: s.layouts,
        activeLayoutId: s.activeLayoutId,
      }),
      // A persisted activeLayoutId can point at a layout the user deleted in
      // another tab; fall back rather than render an empty grid.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DashboardLayoutStore>;
        const layouts = p.layouts?.length ? p.layouts : current.layouts;
        const activeLayoutId = layouts.some((l) => l.id === p.activeLayoutId)
          ? p.activeLayoutId!
          : layouts[0].id;
        return { ...current, layouts, activeLayoutId };
      },
    }
  )
);

/**
 * False until the persisted layouts have been read from localStorage.
 *
 * The server renders the built-in defaults while the browser renders whatever
 * the user actually saved, so any component that renders tiles or layout tabs
 * must wait for this or React reports a hydration mismatch. Deliberately starts
 * `false` even on the client — the first client render has to match the server's.
 */
export function useDashboardLayoutsHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useDashboardLayoutStore.persist.onFinishHydration(onChange),
    () => useDashboardLayoutStore.persist.hasHydrated(),
    // Server snapshot. Returning false here is what makes the first client
    // render match the server's, even though localStorage has already been read
    // by then.
    () => false
  );
}
