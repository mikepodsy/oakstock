"use client";

// The drag-and-resize chart workspace.
//
// Uses react-grid-layout v2's component API with `useContainerWidth` rather than
// the legacy `WidthProvider` HOC — the v1/WidthProvider path still routes
// through react-draggable's findDOMNode, which React 19 removed.

import { useCallback } from "react";
import GridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import { LineChart } from "lucide-react";
import {
  useDashboardLayoutStore,
  useDashboardLayoutsHydrated,
} from "@/stores/dashboardLayoutStore";
import { ChartTileFrame } from "./ChartTileFrame";
import { DashboardToolbar } from "./DashboardToolbar";
import { AddChartDialog } from "./AddChartDialog";

import "react-grid-layout/css/styles.css";

const GRID_CONFIG = {
  cols: 12,
  rowHeight: 40,
  margin: [12, 12] as [number, number],
  containerPadding: [0, 0] as [number, number],
};

// Dragging starts only on the tile header; the chart body owns its own mouse
// events (crosshair, pan, drawing tools) and must not be hijacked.
const DRAG_CONFIG = { handle: ".tile-drag-handle" };
const RESIZE_CONFIG = { handles: ["se", "e", "s"] as const };

export function ChartGrid() {
  const layouts = useDashboardLayoutStore((s) => s.layouts);
  const activeLayoutId = useDashboardLayoutStore((s) => s.activeLayoutId);
  const setGrid = useDashboardLayoutStore((s) => s.setGrid);

  const hydrated = useDashboardLayoutsHydrated();

  const active = layouts.find((l) => l.id === activeLayoutId) ?? layouts[0];

  const { width, containerRef } = useContainerWidth();

  // RGL hands back a readonly Layout; copy it into the mutable array the store holds.
  const onLayoutChange = useCallback(
    (next: Layout) => setGrid([...next]),
    [setGrid]
  );

  // Reserve the space rather than collapsing, so the page doesn't jump when the
  // saved layout arrives a tick later.
  if (!hydrated) {
    return <section className="mt-6 h-96 animate-pulse rounded-xl bg-bg-secondary/40" />;
  }

  return (
    <section className="mt-6">
      <DashboardToolbar />

      <div ref={containerRef} className="w-full">
        {active.tiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-primary py-16 text-center">
            <LineChart className="mb-3 h-10 w-10 text-text-tertiary opacity-60" />
            <p className="mb-1 text-sm text-text-primary">No charts in this layout</p>
            <p className="mb-4 max-w-xs text-xs text-text-secondary">
              Add futures, treasuries, metals or FX through TradingView, or a
              stock chart on Questrade data.
            </p>
            <AddChartDialog />
          </div>
        ) : (
          // width is 0 until the ResizeObserver reports; rendering the grid then
          // would collapse every tile to zero width.
          width > 0 && (
            <GridLayout
              width={width}
              layout={active.grid}
              gridConfig={GRID_CONFIG}
              dragConfig={DRAG_CONFIG}
              resizeConfig={RESIZE_CONFIG}
              onLayoutChange={onLayoutChange}
            >
              {active.tiles.map((tile) => (
                <div key={tile.id}>
                  <ChartTileFrame tile={tile} />
                </div>
              ))}
            </GridLayout>
          )
        )}
      </div>
    </section>
  );
}
