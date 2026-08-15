"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CandlestickChart as CandlestickIcon, PanelRightOpen } from "lucide-react";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { AnalystDetail } from "@/components/analyst/AnalystDetail";
import { useAnalystRating } from "@/hooks/useAnalystRating";
import { useTechnicalRating } from "@/hooks/useTechnicalRating";
import { useWatchlistStore } from "@/stores/watchlistStore";
import {
  DEFAULT_CHART_TYPE,
  DEFAULT_INTERVAL,
  DEFAULT_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  useScannerHydrated,
  useScannerStore,
} from "@/stores/scannerStore";
import { SymbolListPanel } from "./SymbolListPanel";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { TechnicalsDetail } from "./TechnicalsDetail";

// The chart may never take more than this share of the workspace, so dragging
// the panel wide can't squeeze it to nothing on a small window.
const MAX_PANEL_SHARE = 0.6;

export function ScannerWorkspace() {
  const watchlists = useWatchlistStore((s) => s.watchlists);
  const loading = useWatchlistStore((s) => s.loading);
  const initialized = useWatchlistStore((s) => s.initialized);

  const activeWatchlistId = useScannerStore((s) => s.activeWatchlistId);
  const selectedTicker = useScannerStore((s) => s.selectedTicker);
  const panelWidth = useScannerStore((s) => s.panelWidth);
  const panelCollapsed = useScannerStore((s) => s.panelCollapsed);
  const interval = useScannerStore((s) => s.interval);
  const chartType = useScannerStore((s) => s.chartType);
  const setActiveWatchlistId = useScannerStore((s) => s.setActiveWatchlistId);
  const setSelectedTicker = useScannerStore((s) => s.setSelectedTicker);
  const setPanelWidth = useScannerStore((s) => s.setPanelWidth);
  const togglePanel = useScannerStore((s) => s.togglePanel);
  const setScannerInterval = useScannerStore((s) => s.setInterval);
  const setChartType = useScannerStore((s) => s.setChartType);

  // Persisted prefs are read from localStorage synchronously, so the first
  // client render must ignore them or it won't match the server's.
  const hydrated = useScannerHydrated();

  // Transient drill-down, deliberately not persisted: landing on a technicals
  // table after a reload instead of the chart would be surprising.
  const [view, setView] = useState<"chart" | "technicals" | "analysts">("chart");

  const containerRef = useRef<HTMLDivElement>(null);
  // Non-null only while a resize drag is in flight. Rendering `dragWidth ??
  // panelWidth` keeps an unrelated re-render (the 5-minute quote refresh) from
  // snapping the panel back mid-drag.
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId);
  const items = useMemo(() => activeWatchlist?.items ?? [], [activeWatchlist]);

  const collapsed = hydrated ? panelCollapsed : false;
  const width = hydrated ? (dragWidth ?? panelWidth) : DEFAULT_PANEL_WIDTH;
  const ticker = hydrated ? selectedTicker : null;
  const chartInterval = hydrated ? interval : DEFAULT_INTERVAL;
  const chartTypeValue = hydrated ? chartType : DEFAULT_CHART_TYPE;

  // Both fetched once here and handed to the panel widgets and the detail
  // views, so opening a drill-down doesn't fire a second request. The analyst
  // rating takes no interval — consensus doesn't change with candle size.
  const technicals = useTechnicalRating(ticker, chartInterval);
  const analysts = useAnalystRating(ticker);

  // Every user-driven symbol change comes back to the chart — arrowing down the
  // list shouldn't leave you reading a technicals table you didn't ask for.
  const selectTicker = useCallback(
    (next: string) => {
      setSelectedTicker(next);
      setView("chart");
    },
    [setSelectedTicker]
  );

  // Keep the active list pointing at something real (it may have been deleted
  // on another device since it was persisted). Waits for `initialized` — before
  // the fetch lands `watchlists` is empty, which would clear the persisted id.
  useEffect(() => {
    if (!hydrated || !initialized) return;
    if (watchlists.length === 0) {
      if (activeWatchlistId !== null) setActiveWatchlistId(null);
      return;
    }
    if (!watchlists.some((w) => w.id === activeWatchlistId)) {
      setActiveWatchlistId(watchlists[0].id);
    }
  }, [hydrated, initialized, watchlists, activeWatchlistId, setActiveWatchlistId]);

  // Same for the charted symbol: fall back to the first row rather than charting
  // a ticker that is no longer in the list.
  useEffect(() => {
    if (!hydrated || !initialized) return;
    if (items.length === 0) {
      if (selectedTicker !== null) setSelectedTicker(null);
      return;
    }
    if (!items.some((i) => i.ticker === selectedTicker)) {
      setSelectedTicker(items[0].ticker);
    }
  }, [hydrated, initialized, items, selectedTicker, setSelectedTicker]);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    if (collapsed || items.length === 0) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.defaultPrevented) return;

      // Never steal keys from a text field (ticker search, create-list dialog).
      const target = e.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }

      // An open menu or dialog owns the arrow keys. Base UI portals these only
      // while they're open, so this is a live test.
      if (
        document.querySelector(
          '[data-slot="dropdown-menu-content"], [role="dialog"]'
        )
      ) {
        return;
      }

      const delta =
        e.key === "ArrowDown" || e.key === "j"
          ? 1
          : e.key === "ArrowUp" || e.key === "k"
            ? -1
            : 0;
      if (delta === 0) return;

      e.preventDefault();
      const i = items.findIndex((x) => x.ticker === selectedTicker);
      const next = items[((i < 0 ? 0 : i + delta) + items.length) % items.length];
      if (next) selectTicker(next.ticker);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, items, selectedTicker, selectTicker]);

  // ── Panel resize ─────────────────────────────────────────────────────────
  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startWidth = panelWidth;
      const containerWidth =
        containerRef.current?.getBoundingClientRect().width ?? Infinity;
      const maxW = Math.min(MAX_PANEL_WIDTH, containerWidth * MAX_PANEL_SHARE);

      const prevUserSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      let frame = 0;
      let latest = startWidth;

      function onMove(ev: PointerEvent) {
        latest = Math.min(
          maxW,
          Math.max(MIN_PANEL_WIDTH, startWidth - (ev.clientX - startX))
        );
        // One state write per frame, not per pointer event.
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          setDragWidth(latest);
        });
      }

      function onEnd() {
        if (frame) cancelAnimationFrame(frame);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onEnd);
        handle.removeEventListener("pointercancel", onEnd);
        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;
        // Single persisted write, instead of one per frame.
        setPanelWidth(latest);
        setDragWidth(null);
      }

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onEnd);
      handle.addEventListener("pointercancel", onEnd);
    },
    [panelWidth, setPanelWidth]
  );

  const handleNudge = useCallback(
    (delta: number) => setPanelWidth(panelWidth + delta),
    [panelWidth, setPanelWidth]
  );

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 flex-col md:flex-row"
    >
      <div className="relative flex h-[55%] min-h-[280px] shrink-0 flex-col p-3 md:h-auto md:min-h-0 md:min-w-0 md:flex-1">
        {!ticker ? (
          // The chart is never given a placeholder ticker — that would fire a
          // doomed candles request and flash an error.
          <ScannerEmptyChart />
        ) : view === "technicals" ? (
          <TechnicalsDetail
            {...technicals}
            ticker={ticker}
            interval={chartInterval}
            onIntervalChange={setScannerInterval}
            onBack={() => setView("chart")}
          />
        ) : view === "analysts" ? (
          <AnalystDetail
            {...analysts}
            ticker={ticker}
            onBack={() => setView("chart")}
          />
        ) : (
          <CandlestickChart
            ticker={ticker}
            fillHeight
            hideHeading
            interval={chartInterval}
            onIntervalChange={setScannerInterval}
            chartType={chartTypeValue}
            onChartTypeChange={setChartType}
          />
        )}

        {collapsed && (
          // Vertically centred, not top-right: the chart already renders its own
          // buttons up there.
          <button
            onClick={togglePanel}
            title="Show list"
            className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-l-lg border border-r-0 border-border-primary bg-bg-secondary p-1.5 text-text-tertiary transition-colors hover:text-text-primary md:block"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      {!collapsed && (
        <PanelResizeHandle
          onPointerDown={handleResizeStart}
          onNudge={handleNudge}
        />
      )}

      {!collapsed && (
        <SymbolListPanel
          width={width}
          watchlists={watchlists}
          activeWatchlist={activeWatchlist}
          items={items}
          selectedTicker={ticker}
          loading={loading || !initialized}
          technicals={technicals}
          analysts={analysts}
          onSelectWatchlist={setActiveWatchlistId}
          onSelectTicker={selectTicker}
          onCollapse={togglePanel}
          onOpenTechnicals={() => setView("technicals")}
          onOpenAnalysts={() => setView("analysts")}
        />
      )}
    </div>
  );
}

function ScannerEmptyChart() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-lg border border-border-primary bg-bg-secondary text-center">
      <CandlestickIcon className="mb-3 h-10 w-10 text-oak-300 opacity-60" />
      <p className="text-sm text-text-primary">Select a symbol to chart</p>
      <p className="mt-1 text-xs text-text-secondary">
        Click a row, or use ↑ / ↓ to flip through the list.
      </p>
    </div>
  );
}
