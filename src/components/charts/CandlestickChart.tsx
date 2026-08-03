"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  BarSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type AutoscaleInfo,
  type Time,
} from "lightweight-charts";
import {
  ChevronsRight,
  ChevronDown,
  Maximize2,
  Minimize2,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  TrendingUp,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { IndicatorsMenu } from "./IndicatorsMenu";
import { ChartStyleMenu } from "./ChartStyleMenu";
import { StrikeHistogram } from "./StrikeHistogram";
import { GexHistogram } from "./GexHistogram";
import { SessionBackgroundPrimitive } from "./sessionBackground";
import { fetchQuestradeCandles, fetchOptionStrikes } from "@/services/questrade";
import { QUESTRADE_INTERVALS } from "@/utils/constants";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { useThemeStore } from "@/stores/themeStore";
import { withAlpha } from "@/stores/chartStyleStore";
import { useChartStyle, useIndicators } from "./ChartConfigContext";
import {
  useDrawingStore,
  type TrendPoint,
  type Trendline,
} from "@/stores/drawingStore";
import { TrendlinePrimitive } from "./trendlinePrimitive";
import { VolumeProfilePrimitive } from "./volumeProfilePrimitive";
import { computeVolumeProfile } from "@/utils/volumeProfile";
import { distanceToSegment, midpoint } from "@/utils/geometry";
import {
  sma as smaCalc,
  ema as emaCalc,
  bollinger as bollingerCalc,
  donchian as donchianCalc,
  rsi as rsiCalc,
  vwap as vwapCalc,
  sessionSegments,
  type LinePoint,
} from "@/utils/indicators";
import { maColorFor, INDICATOR_COLORS } from "@/utils/indicatorConfig";
import type {
  QuestradeCandle,
  OptionsChainResponse,
  StrikeView,
} from "@/types";

interface CandlestickChartProps {
  ticker: string;
  name?: string;
  website?: string;
  // Fill the parent instead of the fixed 300px embedded height. Set by dashboard
  // tiles, whose height is driven by the resizable grid.
  fillHeight?: boolean;
  // Hide the "Price Chart" caption — dashboard tiles show the symbol in their
  // own header, so repeating it wastes a row.
  hideHeading?: boolean;
  // Interval and chart type are uncontrolled by default (stock page keeps its
  // own local state). Passing a value + handler makes them controlled, which is
  // how dashboard tiles persist them per-tile.
  interval?: string;
  onIntervalChange?: (interval: string) => void;
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
}

type ChartType = "candles" | "bars" | "line";

// Intraday candle sizes — show time (not just date) on the axis for these.
const INTRADAY_INTERVALS = new Set([
  "OneMinute",
  "FiveMinutes",
  "FifteenMinutes",
  "OneHour",
  "FourHours",
]);

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

// Drawn horizontal lines: a distinct cyan so they read differently from the
// indicator overlays (blue/amber/purple).
const DRAW_LINE_COLOR = "#22d3ee";
// Volume bars stay a fixed green/red regardless of how candles/bars are
// recolored, so the histogram remains a consistent up/down read.
const VOLUME_UP = "#22C55E";
const VOLUME_DOWN = "#EF4444";
// Stable empty reference so the store selector doesn't churn when a ticker has
// no lines yet (avoids re-render loops).
const EMPTY_LINES: { id: string; price: number }[] = [];
// Stable empty reference for trendlines (same churn-avoidance reason as above).
const EMPTY_TRENDLINES: Trendline[] = [];
// How close (px) the cursor must be to a line to grab it.
const LINE_HIT_PX = 6;
// How close (px) the cursor must be to a trendline endpoint / segment to grab it.
const TREND_ENDPOINT_PX = 8;
const TREND_SEGMENT_PX = 6;

// The active drawing tool armed from the Lines dropdown. "none" = normal
// pan/edit; "hline"/"trendline" arm a placement gesture for the next clicks.
type DrawTool = "none" | "hline" | "trendline";

// Round a clicked/dragged price to a sensible precision for its magnitude.
function roundPrice(p: number): number {
  const decimals = Math.abs(p) >= 1 ? 2 : 4;
  return Number(p.toFixed(decimals));
}

export function CandlestickChart({
  ticker,
  name,
  website,
  fillHeight = false,
  hideHeading = false,
  interval: intervalProp,
  onIntervalChange,
  chartType: chartTypeProp,
  onChartTypeChange,
}: CandlestickChartProps) {
  // Controlled when the parent supplies a value, otherwise locally owned. Both
  // setters keep the same signature so every existing call site is unchanged.
  const [intervalState, setIntervalState] = useState("OneDay");
  const interval = intervalProp ?? intervalState;
  const setInterval = useCallback(
    (next: string) => {
      setIntervalState(next);
      onIntervalChange?.(next);
    },
    [onIntervalChange]
  );

  const [chartTypeState, setChartTypeState] = useState<ChartType>("candles");
  const chartType = chartTypeProp ?? chartTypeState;
  const setChartType = useCallback(
    (next: ChartType) => {
      setChartTypeState(next);
      onChartTypeChange?.(next);
    },
    [onChartTypeChange]
  );
  const [data, setData] = useState<QuestradeCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Options strike-breakdown panel (fullscreen only). Lazily fetched so the
  // embedded chart never pays the options API cost.
  const [optionsMetric, setOptionsMetric] = useState<"oi" | "volume">("oi");
  // How the GEX / strike histograms render: net diverging vs call/put split.
  const [strikeView, setStrikeView] = useState<StrikeView>("net");
  // Explicitly selected expiry dates (YYYY-MM-DD) to aggregate. Empty until the
  // first response arrives, then seeded to the nearest expiry.
  const [selectedExpiries, setSelectedExpiries] = useState<string[]>([]);
  const [optionsData, setOptionsData] = useState<OptionsChainResponse | null>(
    null
  );
  const [optionsLoading, setOptionsLoading] = useState(false);
  // Collapse the options panels out of the way so the price chart goes full width.
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);
  // Which side panel is shown: GEX histogram or the Options OI/Volume breakdown.
  const [panelView, setPanelView] = useState<"gex" | "oi">("gex");
  // Bumped whenever the chart is recreated, so the histogram re-binds to the new
  // series instance (refs alone don't trigger a re-render).
  const [chartEpoch, setChartEpoch] = useState(0);
  // Latest price + today's change (last daily close vs prior daily close).
  // Fetched independently of the chart interval so it stays a true day change.
  const [quote, setQuote] = useState<{
    price: number;
    changePercent: number;
  } | null>(null);
  const theme = useThemeStore((s) => s.theme);
  // Candle/background style config — this tile's own when the chart sits inside
  // a ChartConfigProvider (dashboard), the global persisted store otherwise.
  // Applied live to the existing chart via applyOptions, so edits don't recreate
  // the canvas.
  const chartStyle = useChartStyle();
  // Latest style for the chart-creation effect below, which must not re-run when
  // a color changes. Seeded on mount, then kept fresh by the effect underneath.
  const chartStyleRef = useRef(chartStyle);
  useEffect(() => {
    chartStyleRef.current = chartStyle;
  }, [chartStyle]);

  // Indicator config (per-tile or global, same as the style above). Selected as
  // individual slices so each effect only re-runs when its own indicator changes.
  const smaCfg = useIndicators((s) => s.sma);
  const emaCfg = useIndicators((s) => s.ema);
  const bollingerCfg = useIndicators((s) => s.bollinger);
  const donchianCfg = useIndicators((s) => s.donchian);
  const rsiCfg = useIndicators((s) => s.rsi);
  // Optional-chained at every use: persisted indicator state written before VWAP
  // existed has no `vwap` key until zustand's merge fills in the default.
  const vwapCfg = useIndicators((s) => s.vwap);
  const volumeCfg = useIndicators((s) => s.volume);
  const volumeProfileCfg = useIndicators((s) => s.volumeProfile);
  const sessionsCfg = useIndicators((s) => s.sessions);

  // User-drawn horizontal lines for this ticker (persisted, per-symbol).
  const linesRaw = useDrawingStore((s) => s.lines[ticker]);
  const lines = linesRaw ?? EMPTY_LINES;
  const addLine = useDrawingStore((s) => s.addLine);
  const moveLine = useDrawingStore((s) => s.moveLine);
  const removeLine = useDrawingStore((s) => s.removeLine);

  // User-drawn diagonal trendlines for this ticker (persisted, per-symbol).
  const trendlinesRaw = useDrawingStore((s) => s.trendlines[ticker]);
  const trendlines = trendlinesRaw ?? EMPTY_TRENDLINES;
  const addTrendline = useDrawingStore((s) => s.addTrendline);
  const moveTrendline = useDrawingStore((s) => s.moveTrendline);
  const removeTrendline = useDrawingStore((s) => s.removeTrendline);
  const clearAll = useDrawingStore((s) => s.clearAll);

  // Draw-line tool state: hover tracks the horizontal line under the cursor (for
  // the drag handle + ✕ delete affordance). New lines are added by double-click
  // or by arming a tool from the Lines dropdown.
  const [hover, setHover] = useState<{ id: string; y: number } | null>(null);
  const priceLineRefs = useRef<Map<string, IPriceLine>>(new Map());
  const dragRef = useRef<string | null>(null);

  // Trendline tool: the armed tool, the in-progress first point, the hovered
  // trendline (for highlight + ✕), and the active endpoint drag. The primitive
  // does the actual rendering.
  const [activeTool, setActiveTool] = useState<DrawTool>("none");
  const [pendingP1, setPendingP1] = useState<TrendPoint | null>(null);
  const [trendHover, setTrendHover] = useState<{
    id: string;
    mid: { x: number; y: number };
  } | null>(null);
  const trendlinePrimitiveRef = useRef<TrendlinePrimitive | null>(null);
  const trendDragRef = useRef<{ id: string; endpoint: "p1" | "p2" } | null>(
    null
  );
  // Briefly swallow the dblclick that trails a tool placement so it doesn't drop
  // a stray horizontal line at the same spot.
  const suppressDblClickRef = useRef(false);
  // Vertical price-pan offset (price units) added to the autoscaled range so the
  // user can drag the candles up/down into empty space. 0 = normal autoscale.
  const priceOffsetRef = useRef(0);

  // Shift the autoscaled price range by priceOffsetRef so the candles can be
  // dragged vertically into empty space. lightweight-charts has no direct price
  // pan, so we customize its autoscale instead.
  const autoscaleProvider = useCallback(
    (getDefault: () => AutoscaleInfo | null): AutoscaleInfo | null => {
      const base = getDefault();
      const off = priceOffsetRef.current;
      if (!base || !base.priceRange || off === 0) return base;
      return {
        priceRange: {
          minValue: base.priceRange.minValue + off,
          maxValue: base.priceRange.maxValue + off,
        },
        margins: base.margins,
      };
    },
    []
  );

  // Re-run autoscale so the offset above takes effect (a fresh closure forces
  // lightweight-charts to recompute rather than skip an unchanged provider).
  const forceRefit = useCallback(() => {
    candleSeriesRef.current?.applyOptions({
      autoscaleInfoProvider: (d: () => AutoscaleInfo | null) =>
        autoscaleProvider(d),
    });
  }, [autoscaleProvider]);

  // Scrolling the wheel over an options panel pans the shared price axis (and
  // thus the price-aligned strike bars) up/down, reusing the same vertical
  // offset as the chart's drag-to-pan. Scroll up reveals higher strikes.
  // Attached via a callback ref as a non-passive native listener so
  // preventDefault actually stops the page from scrolling — React's synthetic
  // onWheel is passive and can't.
  const panelWheelCleanup = useRef<(() => void) | null>(null);
  const attachPanelWheel = useCallback(
    (node: HTMLDivElement | null) => {
      panelWheelCleanup.current?.();
      panelWheelCleanup.current = null;
      if (!node) return;
      const onWheel = (e: WheelEvent) => {
        const series = candleSeriesRef.current;
        if (!series) return;
        e.preventDefault();
        // Price-per-pixel from two sample coordinates (independent of margins).
        const pA = series.coordinateToPrice(100);
        const pB = series.coordinateToPrice(200);
        if (pA == null || pB == null) return;
        const pricePerPixel = (pA - pB) / 100;
        priceOffsetRef.current -= e.deltaY * pricePerPixel;
        forceRefit();
      };
      node.addEventListener("wheel", onWheel, { passive: false });
      panelWheelCleanup.current = () =>
        node.removeEventListener("wheel", onWheel);
    },
    [forceRefit]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const candleSeriesRef = useRef<ISeriesApi<
    "Candlestick" | "Bar" | "Line"
  > | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // Dynamically added overlay/oscillator line series, torn down + rebuilt on change.
  const indicatorSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const sessionPrimitiveRef = useRef<SessionBackgroundPrimitive | null>(null);
  const volumeProfilePrimitiveRef = useRef<VolumeProfilePrimitive | null>(null);

  // Fetch candles whenever the symbol or timeframe changes.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchQuestradeCandles(ticker, interval);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart");
    } finally {
      setLoading(false);
    }
  }, [ticker, interval]);

  useEffect(() => {
    load();
  }, [load]);

  // Pull the latest two daily candles to derive current price and today's
  // change, regardless of which interval the chart is showing.
  useEffect(() => {
    let cancelled = false;
    setQuote(null);
    fetchQuestradeCandles(ticker, "OneDay")
      .then((daily) => {
        if (cancelled || daily.length < 2) return;
        const last = daily[daily.length - 1];
        const prev = daily[daily.length - 2];
        if (prev.close === 0) return;
        setQuote({
          price: last.close,
          changePercent: ((last.close - prev.close) / prev.close) * 100,
        });
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Jump back to the most recent candle: scroll to real time and clear any
  // vertical price pan so the latest candle re-centers in the frame.
  const goToLatest = useCallback(() => {
    priceOffsetRef.current = 0;
    forceRefit();
    chartRef.current?.timeScale().scrollToRealTime();
  }, [forceRefit]);

  // Lazily fetch the options strike breakdown — only while fullscreen, and
  // re-fetch on ticker/window change. Keeps the embedded chart off the options
  // API entirely.
  const expiryKey = selectedExpiries.join(",");
  useEffect(() => {
    if (!fullscreen) return;

    let cancelled = false;
    setOptionsLoading(true);
    fetchOptionStrikes(ticker, selectedExpiries)
      .then((res) => {
        if (cancelled) return;
        setOptionsData(res);
        // Seed the selection to the nearest expiry (0DTE if today is one) the
        // first time we learn the available expiries for this ticker.
        if (selectedExpiries.length === 0 && res.expiries.length > 0) {
          setSelectedExpiries([res.expiries[0].date]);
        }
      })
      .catch(() => {
        if (!cancelled) setOptionsData(null);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, ticker, expiryKey]);

  // Reset the expiry selection when switching tickers so it re-seeds.
  useEffect(() => {
    setSelectedExpiries([]);
  }, [ticker]);

  // While expanded: exit on Escape and lock background scroll. The chart uses
  // autoSize (ResizeObserver), so growing the wrapper resizes it automatically —
  // no need to recreate the chart.
  useEffect(() => {
    if (!fullscreen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  // Create the chart + series. Recreated on theme change so canvas colors
  // (which must be resolved hex, not CSS var() strings) refresh.
  useEffect(() => {
    if (!containerRef.current) return;

    // Read the latest style imperatively so this effect doesn't recreate the
    // chart on every color tweak — the dedicated style effect below applies
    // those live. Theme CSS vars remain the fallback for unset values.
    const style = chartStyleRef.current;
    const up = withAlpha(style.body.up, style.candleUpOpacity);
    const down = withAlpha(style.body.down, style.candleDownOpacity);
    const barUp = withAlpha(style.bar.up, style.candleUpOpacity);
    const barDown = withAlpha(style.bar.down, style.candleDownOpacity);
    const lineColor = style.line;
    const text = cssVar("--text-tertiary", "#8b8b8b");
    const bg = withAlpha(style.background, style.backgroundOpacity);
    const grid = cssVar("--border-primary", "#222222");

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { textColor: text, background: { type: ColorType.Solid, color: bg } },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      // Free-moving crosshair (don't snap to candle OHLC), so the cursor can
      // wander into empty space above/below/beside the candles.
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: grid },
      timeScale: {
        borderColor: grid,
        secondsVisible: false,
        // Pin the left edge so scrolling out never leaves empty space before the
        // first candle, but leave the right edge free so you can drag ahead into
        // empty space past the latest candle.
        fixLeftEdge: true,
        fixRightEdge: false,
      },
    });

    const autoscaleInfoProvider = (d: () => AutoscaleInfo | null) =>
      autoscaleProvider(d);
    const candleSeries =
      chartType === "bars"
        ? chart.addSeries(BarSeries, {
            upColor: barUp,
            downColor: barDown,
            autoscaleInfoProvider,
          })
        : chartType === "line"
          ? chart.addSeries(LineSeries, {
              color: lineColor,
              lineWidth: 2,
              priceLineVisible: false,
              autoscaleInfoProvider,
            })
          : chart.addSeries(CandlestickSeries, {
              upColor: up,
              downColor: down,
              borderVisible: style.border.visible,
              borderUpColor: style.border.up,
              borderDownColor: style.border.down,
              wickVisible: style.wick.visible,
              wickUpColor: style.wick.up,
              wickDownColor: style.wick.down,
              autoscaleInfoProvider,
            });
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.25 },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "", // overlay — not tied to the price axis
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    // Let the strike histogram re-bind to this fresh series instance.
    setChartEpoch((e) => e + 1);

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      // The removed chart took its indicator series + primitives with it.
      indicatorSeriesRef.current = [];
      sessionPrimitiveRef.current = null;
      volumeProfilePrimitiveRef.current = null;
    };
  }, [theme, chartType, autoscaleProvider]);

  // Apply candle/background style live to the existing chart + series. Runs on
  // any style change (and after the chart is recreated, since the candle series
  // ref changes). No recreation → no flicker, viewport preserved.
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart) return;

    const up = withAlpha(chartStyle.body.up, chartStyle.candleUpOpacity);
    const down = withAlpha(chartStyle.body.down, chartStyle.candleDownOpacity);
    const barUp = withAlpha(chartStyle.bar.up, chartStyle.candleUpOpacity);
    const barDown = withAlpha(chartStyle.bar.down, chartStyle.candleDownOpacity);

    chart.applyOptions({
      layout: {
        background: {
          type: ColorType.Solid,
          color: withAlpha(chartStyle.background, chartStyle.backgroundOpacity),
        },
      },
    });

    // Border/wick options only exist on the candlestick series; bars and line
    // map their up/down to the body colors.
    if (candleSeries) {
      if (chartType === "candles") {
        (candleSeries as ISeriesApi<"Candlestick">).applyOptions({
          upColor: up,
          downColor: down,
          borderVisible: chartStyle.border.visible,
          borderUpColor: chartStyle.border.up,
          borderDownColor: chartStyle.border.down,
          wickVisible: chartStyle.wick.visible,
          wickUpColor: chartStyle.wick.up,
          wickDownColor: chartStyle.wick.down,
        });
      } else if (chartType === "bars") {
        (candleSeries as ISeriesApi<"Bar">).applyOptions({
          upColor: barUp,
          downColor: barDown,
        });
      } else if (chartType === "line") {
        (candleSeries as ISeriesApi<"Line">).applyOptions({
          color: chartStyle.line,
        });
      }
    }
  }, [chartStyle, chartType, theme]);

  // Push data into the series when it (or the recreated chart) changes.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart || data.length === 0) return;

    if (chartType === "line") {
      (candleSeries as ISeriesApi<"Line">).setData(
        data.map((c) => ({
          time: (Date.parse(c.time) / 1000) as UTCTimestamp,
          value: c.close,
        }))
      );
    } else {
      (candleSeries as ISeriesApi<"Candlestick" | "Bar">).setData(
        data.map((c) => ({
          time: (Date.parse(c.time) / 1000) as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
    }

    volumeSeries.setData(
      data.map((c) => ({
        time: (Date.parse(c.time) / 1000) as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? VOLUME_UP : VOLUME_DOWN,
      }))
    );

    chart.timeScale().applyOptions({ timeVisible: INTRADAY_INTERVALS.has(interval) });
    // Open on the most recent data rather than fitting the whole history, so a
    // fresh chart / interval change lands on the current day.
    chart.timeScale().scrollToRealTime();
  }, [data, theme, interval, chartType]);

  // Rebuild indicator overlays + the RSI sub-pane whenever the data, theme
  // (chart recreate) or any indicator config changes. Full teardown + rebuild
  // is simplest and correct; the datasets are small.
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries || data.length === 0) return;

    // Tear down previously added series and any extra (RSI) panes.
    for (const series of indicatorSeriesRef.current) {
      try {
        chart.removeSeries(series);
      } catch {
        /* already gone (chart was recreated) */
      }
    }
    indicatorSeriesRef.current = [];
    const panes = chart.panes();
    for (let i = panes.length - 1; i >= 1; i--) {
      chart.removePane(i);
    }

    const grid = cssVar("--border-primary", "#222222");

    const addLine = (
      points: LinePoint[],
      options: Record<string, unknown>,
      paneIndex?: number
    ) => {
      // Price-pane overlays (SMA/EMA/Bollinger/Donchian) must share the candle
      // series' vertical pan offset, otherwise autoscale stretches to cover both
      // the shifted candles and the unshifted lines (compressing the view). RSI
      // lives in its own pane/scale, so it keeps the default autoscale.
      const onPricePane = paneIndex === undefined || paneIndex === 0;
      const series = chart.addSeries(
        LineSeries,
        {
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          ...(onPricePane
            ? {
                autoscaleInfoProvider: (d: () => AutoscaleInfo | null) =>
                  autoscaleProvider(d),
              }
            : {}),
          ...options,
        },
        paneIndex
      );
      series.setData(points);
      indicatorSeriesRef.current.push(series);
      return series;
    };

    if (smaCfg.enabled) {
      smaCfg.periods.forEach((p, idx) =>
        addLine(smaCalc(data, p), { color: maColorFor(smaCfg.colors, p, idx) })
      );
    }
    if (emaCfg.enabled) {
      emaCfg.periods.forEach((p, idx) =>
        addLine(emaCalc(data, p), {
          color: maColorFor(emaCfg.colors, p, idx),
          lineStyle: LineStyle.Dashed,
        })
      );
    }
    if (vwapCfg?.enabled) {
      // Session-anchored VWAP is drawn as one series per day so the line breaks
      // at each reset instead of snapping vertically across the session gap.
      // On daily+ candles every bar is its own session, so a session anchor
      // would just retrace the typical price — fall back to the rolling window.
      const anchor = INTRADAY_INTERVALS.has(interval) ? vwapCfg.anchor : "rolling";
      const points = vwapCalc(data, anchor, vwapCfg.period);
      const color = vwapCfg.color ?? INDICATOR_COLORS.vwap;
      if (anchor === "session") {
        let segment: typeof points = [];
        for (let i = 0; i < points.length; i++) {
          // A reset restarts the cumulative average, so the value jumps back to
          // the bar's own typical price — detect the boundary by day.
          const prev = points[i - 1];
          const isNewDay =
            prev !== undefined &&
            new Date(points[i].time * 1000).getUTCDate() !==
              new Date(prev.time * 1000).getUTCDate() &&
            points[i].time - prev.time > 3600;
          if (isNewDay && segment.length) {
            addLine(segment, { color, lineWidth: 2 });
            segment = [];
          }
          segment.push(points[i]);
        }
        if (segment.length) addLine(segment, { color, lineWidth: 2 });
      } else {
        addLine(points, { color, lineWidth: 2 });
      }
    }
    if (bollingerCfg.enabled) {
      const color = bollingerCfg.color ?? INDICATOR_COLORS.bollinger;
      const b = bollingerCalc(data, bollingerCfg.period, bollingerCfg.mult);
      addLine(b.upper, { color, lineWidth: 1 });
      addLine(b.middle, {
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
      });
      addLine(b.lower, { color, lineWidth: 1 });
    }
    if (donchianCfg.enabled) {
      const color = donchianCfg.color ?? INDICATOR_COLORS.donchian;
      const d = donchianCalc(data, donchianCfg.period);
      addLine(d.upper, { color, lineWidth: 1 });
      addLine(d.middle, {
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
      });
      addLine(d.lower, { color, lineWidth: 1 });
    }
    if (rsiCfg.enabled) {
      const line = addLine(
        rsiCalc(data, rsiCfg.period),
        { color: rsiCfg.color ?? INDICATOR_COLORS.rsi, lineWidth: 2 },
        1
      );
      line.createPriceLine({
        price: 70,
        color: grid,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "",
      });
      line.createPriceLine({
        price: 30,
        color: grid,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "",
      });
      // Keep the RSI pane roughly a quarter of the height.
      const all = chart.panes();
      all[0]?.setStretchFactor(3);
      all[1]?.setStretchFactor(1);
    }

    volumeSeriesRef.current?.applyOptions({ visible: volumeCfg.enabled });
  }, [
    data,
    theme,
    chartType,
    smaCfg,
    emaCfg,
    bollingerCfg,
    donchianCfg,
    rsiCfg,
    vwapCfg,
    interval,
    volumeCfg,
    autoscaleProvider,
  ]);

  // Attach/detach the intraday session-shading background.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;
    const shouldShow =
      sessionsCfg.enabled && INTRADAY_INTERVALS.has(interval) && data.length > 0;

    if (shouldShow) {
      if (!sessionPrimitiveRef.current) {
        const primitive = new SessionBackgroundPrimitive();
        candleSeries.attachPrimitive(primitive);
        sessionPrimitiveRef.current = primitive;
      }
      sessionPrimitiveRef.current.setSegments(sessionSegments(data));
    } else if (sessionPrimitiveRef.current) {
      try {
        candleSeries.detachPrimitive(sessionPrimitiveRef.current);
      } catch {
        /* series already removed */
      }
      sessionPrimitiveRef.current = null;
    }
  }, [sessionsCfg, interval, data, theme, chartType]);

  // Volume Profile: aggregate the candles in the visible range into a
  // volume-by-price histogram and hand it to the overlay primitive. Recomputes
  // on pan/zoom (time-scale subscription) and whenever the data/config/chart
  // changes. Detached entirely when the indicator is off.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !chart) return;

    if (!volumeProfileCfg.enabled || data.length === 0) {
      if (volumeProfilePrimitiveRef.current) {
        try {
          candleSeries.detachPrimitive(volumeProfilePrimitiveRef.current);
        } catch {
          /* series already removed */
        }
        volumeProfilePrimitiveRef.current = null;
      }
      return;
    }

    if (!volumeProfilePrimitiveRef.current) {
      const primitive = new VolumeProfilePrimitive();
      candleSeries.attachPrimitive(primitive);
      volumeProfilePrimitiveRef.current = primitive;
    }

    const timeScale = chart.timeScale();
    const recompute = () => {
      const range = timeScale.getVisibleRange();
      const visible = range
        ? data.filter((c) => {
            const t = Date.parse(c.time) / 1000;
            return t >= (range.from as number) && t <= (range.to as number);
          })
        : data;
      const profile = computeVolumeProfile(visible, volumeProfileCfg.rows);
      volumeProfilePrimitiveRef.current?.setProfile(
        profile,
        volumeProfileCfg.showValueArea
      );
    };

    // Throttle the pan/zoom handler to one recompute per frame.
    let raf = 0;
    const onRangeChange = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        recompute();
      });
    };

    recompute();
    timeScale.subscribeVisibleLogicalRangeChange(onRangeChange);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      try {
        timeScale.unsubscribeVisibleLogicalRangeChange(onRangeChange);
      } catch {
        /* chart already removed */
      }
    };
  }, [volumeProfileCfg, data, theme, chartType, chartEpoch]);

  // Render the drawn horizontal lines as native price lines on the candle
  // series — they span the full width, get a right-axis price label for free,
  // and stay synced through pan/zoom. Full teardown + rebuild on change (and
  // after the chart is recreated on theme/type change); the set is tiny.
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    for (const pl of priceLineRefs.current.values()) {
      try {
        series.removePriceLine(pl);
      } catch {
        /* series was recreated; the line went with it */
      }
    }
    priceLineRefs.current.clear();
    for (const line of lines) {
      const pl = series.createPriceLine({
        price: line.price,
        color: DRAW_LINE_COLOR,
        lineWidth: 2,
        axisLabelVisible: true,
        title: "",
      });
      priceLineRefs.current.set(line.id, pl);
    }
  }, [lines, theme, chartType, data]);

  // Attach the trendline primitive to the (re)created candle series. chartEpoch
  // bumps whenever the chart is rebuilt, so this re-binds to the fresh series.
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const primitive = new TrendlinePrimitive();
    series.attachPrimitive(primitive);
    trendlinePrimitiveRef.current = primitive;
    primitive.setTrendlines(trendlines);
    return () => {
      try {
        series.detachPrimitive(primitive);
      } catch {
        /* series already removed */
      }
      trendlinePrimitiveRef.current = null;
    };
    // trendlines intentionally omitted — kept in sync by the effect below so we
    // don't re-attach (and lose the canvas) on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartEpoch]);

  // Keep the primitive's data in sync without re-attaching.
  useEffect(() => {
    trendlinePrimitiveRef.current?.setTrendlines(trendlines);
  }, [trendlines]);

  useEffect(() => {
    trendlinePrimitiveRef.current?.setHovered(trendHover?.id ?? null);
  }, [trendHover]);

  // Cancel an in-progress trendline (and disarm the tool) on Escape.
  useEffect(() => {
    if (activeTool === "none" && !pendingP1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveTool("none");
        setPendingP1(null);
        trendlinePrimitiveRef.current?.setDraft(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTool, pendingP1]);

  // Cursor y relative to the chart container's top, matching the coordinate
  // space lightweight-charts uses for priceToCoordinate / coordinateToPrice.
  const relativeY = useCallback((clientY: number): number | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? clientY - rect.top : null;
  }, []);

  // Cursor x/y relative to the chart container's top-left.
  const relativeXY = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const rect = containerRef.current?.getBoundingClientRect();
      return rect ? { x: clientX - rect.left, y: clientY - rect.top } : null;
    },
    []
  );

  // Map a cursor position to a trendline point. Price is free; time snaps to the
  // nearest candle column (lightweight-charts maps x-coords to data slots).
  const eventToTrendPoint = useCallback(
    (clientX: number, clientY: number): TrendPoint | null => {
      const series = candleSeriesRef.current;
      const chart = chartRef.current;
      const rel = relativeXY(clientX, clientY);
      if (!series || !chart || !rel) return null;
      const price = series.coordinateToPrice(rel.y);
      const time = chart.timeScale().coordinateToTime(rel.x);
      if (price == null || time == null) return null;
      return { time: time as number, price: roundPrice(price) };
    },
    [relativeXY]
  );

  // Pixel coordinates of a trendline endpoint, or null if it's off-scale.
  const trendPointToXY = useCallback(
    (pt: TrendPoint): { x: number; y: number } | null => {
      const series = candleSeriesRef.current;
      const chart = chartRef.current;
      if (!series || !chart) return null;
      const x = chart.timeScale().timeToCoordinate(pt.time as Time);
      const y = series.priceToCoordinate(pt.price);
      if (x == null || y == null) return null;
      return { x, y };
    },
    []
  );

  // Hover detection: highlight the nearest line within the grab threshold.
  const onChartMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current || trendDragRef.current) return; // drag owns the move

      // Placing a trendline: rubber-band the preview from p1 to the cursor.
      if (activeTool === "trendline" && pendingP1) {
        const cursor = eventToTrendPoint(e.clientX, e.clientY);
        if (cursor)
          trendlinePrimitiveRef.current?.setDraft({ p1: pendingP1, cursor });
        return;
      }
      // A tool is armed but no first point yet — nothing to hover.
      if (activeTool !== "none") return;

      const series = candleSeriesRef.current;
      const rel = relativeXY(e.clientX, e.clientY);
      if (!rel || !series) {
        setHover((prev) => (prev ? null : prev));
        setTrendHover((prev) => (prev ? null : prev));
        return;
      }

      // Horizontal-line hover (drag handle + ✕).
      let best: { id: string; y: number } | null = null;
      let bestDist = LINE_HIT_PX;
      for (const line of lines) {
        const coord = series.priceToCoordinate(line.price);
        if (coord == null) continue;
        const d = Math.abs(coord - rel.y);
        if (d < bestDist) {
          bestDist = d;
          best = { id: line.id, y: coord };
        }
      }
      setHover((prev) => {
        if (!best && !prev) return prev;
        if (best && prev && best.id === prev.id && best.y === prev.y) return prev;
        return best;
      });

      // Trendline hover: nearest by endpoint, else by segment body.
      let tBest: { id: string; mid: { x: number; y: number } } | null = null;
      let tBestDist = TREND_SEGMENT_PX;
      for (const t of trendlines) {
        const a = trendPointToXY(t.p1);
        const b = trendPointToXY(t.p2);
        if (!a || !b) continue;
        const endpointDist = Math.min(
          Math.hypot(rel.x - a.x, rel.y - a.y),
          Math.hypot(rel.x - b.x, rel.y - b.y)
        );
        const segDist = distanceToSegment(rel, a, b);
        const d = Math.min(
          endpointDist <= TREND_ENDPOINT_PX ? 0 : Infinity,
          segDist
        );
        if (d < tBestDist) {
          tBestDist = d;
          tBest = { id: t.id, mid: midpoint(a, b) };
        }
      }
      setTrendHover((prev) => {
        if (!tBest && !prev) return prev;
        if (
          tBest &&
          prev &&
          tBest.id === prev.id &&
          tBest.mid.x === prev.mid.x &&
          tBest.mid.y === prev.mid.y
        )
          return prev;
        return tBest;
      });
    },
    [
      activeTool,
      pendingP1,
      eventToTrendPoint,
      lines,
      trendlines,
      relativeXY,
      trendPointToXY,
    ]
  );

  // Press on a hovered line to start dragging it vertically. Live-updates the
  // price line via applyOptions and commits to the store on release. Pan/zoom
  // is suspended for the duration so the drag doesn't scroll the chart.
  const onChartMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const series = candleSeriesRef.current;
      const chart = chartRef.current;
      if (!series || !chart) return;

      // A drawing tool is armed → clicks place points (handled in onClick); don't
      // start a pan/drag here.
      if (activeTool !== "none") return;

      // On a trendline endpoint → drag just that endpoint.
      const rel = relativeXY(e.clientX, e.clientY);
      if (rel) {
        for (const t of trendlines) {
          const a = trendPointToXY(t.p1);
          const b = trendPointToXY(t.p2);
          if (!a || !b) continue;
          const onP1 = Math.hypot(rel.x - a.x, rel.y - a.y) <= TREND_ENDPOINT_PX;
          const onP2 = Math.hypot(rel.x - b.x, rel.y - b.y) <= TREND_ENDPOINT_PX;
          if (!onP1 && !onP2) continue;

          e.preventDefault();
          const endpoint: "p1" | "p2" = onP1 ? "p1" : "p2";
          trendDragRef.current = { id: t.id, endpoint };
          chart.applyOptions({ handleScroll: false, handleScale: false });
          let last = endpoint === "p1" ? t.p1 : t.p2;

          const move = (ev: MouseEvent) => {
            const pt = eventToTrendPoint(ev.clientX, ev.clientY);
            if (!pt) return;
            last = pt;
            const next = trendlines.map((tl) =>
              tl.id === t.id ? { ...tl, [endpoint]: pt } : tl
            );
            trendlinePrimitiveRef.current?.setTrendlines(next);
          };
          const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            trendDragRef.current = null;
            chartRef.current?.applyOptions({
              handleScroll: true,
              handleScale: true,
            });
            const p1 = endpoint === "p1" ? last : t.p1;
            const p2 = endpoint === "p2" ? last : t.p2;
            moveTrendline(ticker, t.id, p1, p2);
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
          return;
        }
      }

      // On a line → drag the line vertically (existing behavior).
      if (hover) {
        const id = hover.id;
        e.preventDefault();
        dragRef.current = id;
        chart.applyOptions({ handleScroll: false, handleScale: false });
        let lastPrice = lines.find((l) => l.id === id)?.price ?? null;

        const move = (ev: MouseEvent) => {
          const yc = relativeY(ev.clientY);
          if (yc == null) return;
          const price = series.coordinateToPrice(yc);
          if (price == null) return;
          lastPrice = roundPrice(price);
          priceLineRefs.current.get(id)?.applyOptions({ price: lastPrice });
          setHover({ id, y: yc });
        };
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
          dragRef.current = null;
          chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
          if (lastPrice != null) moveLine(ticker, id, lastPrice);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
        return;
      }

      // Otherwise → drag the chart body up/down to pan price into empty space.
      // Skip the price axis itself so its native scaling still works.
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const axisW = chart.priceScale("right").width() ?? 0;
      if (e.clientX - rect.left > rect.width - axisW) return;

      // Price-per-pixel from two sample coordinates (independent of margins).
      const pA = series.coordinateToPrice(100);
      const pB = series.coordinateToPrice(200);
      if (pA == null || pB == null) return;
      const pricePerPixel = (pA - pB) / 100;

      const startY = e.clientY;
      const off0 = priceOffsetRef.current;
      dragRef.current = "__pan__"; // suppresses line hover while panning

      // Leave native scrolling enabled: a horizontal drag still scrolls time
      // while this adds the vertical price offset — diagonal drags do both.
      const move = (ev: MouseEvent) => {
        priceOffsetRef.current = off0 + (ev.clientY - startY) * pricePerPixel;
        forceRefit();
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        dragRef.current = null;
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [
      activeTool,
      hover,
      lines,
      moveLine,
      relativeY,
      relativeXY,
      trendlines,
      trendPointToXY,
      eventToTrendPoint,
      moveTrendline,
      ticker,
      forceRefit,
    ]
  );

  // Single click with a tool armed places points: one click for a horizontal
  // line, two clicks for a trendline. The tool disarms after placing.
  const onChartClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === "none") return;
      const pt = eventToTrendPoint(e.clientX, e.clientY);
      if (!pt) return;

      // Don't place when clicking the price axis.
      const rect = containerRef.current?.getBoundingClientRect();
      const axisW = chartRef.current?.priceScale("right").width() ?? 0;
      if (rect && e.clientX - rect.left > rect.width - axisW) return;

      const finish = () => {
        setActiveTool("none");
        suppressDblClickRef.current = true;
        window.setTimeout(() => {
          suppressDblClickRef.current = false;
        }, 400);
      };

      if (activeTool === "hline") {
        addLine(ticker, pt.price);
        finish();
        return;
      }

      // trendline
      if (!pendingP1) {
        setPendingP1(pt);
        trendlinePrimitiveRef.current?.setDraft({ p1: pt, cursor: pt });
      } else {
        addTrendline(ticker, pendingP1, pt);
        setPendingP1(null);
        trendlinePrimitiveRef.current?.setDraft(null);
        finish();
      }
    },
    [activeTool, pendingP1, eventToTrendPoint, addLine, addTrendline, ticker]
  );

  // Double-click the price axis to reset the vertical pan back to autoscale;
  // double-click anywhere else to drop a new horizontal line.
  const onChartDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Swallow the dblclick that trails a tool placement; ignore while a tool
      // is armed (clicks are handled by onChartClick).
      if (suppressDblClickRef.current) {
        suppressDblClickRef.current = false;
        return;
      }
      if (activeTool !== "none") return;

      const series = candleSeriesRef.current;
      const yc = relativeY(e.clientY);
      if (yc == null || !series) return;

      const rect = containerRef.current?.getBoundingClientRect();
      const axisW = chartRef.current?.priceScale("right").width() ?? 0;
      if (rect && e.clientX - rect.left > rect.width - axisW) {
        priceOffsetRef.current = 0;
        forceRefit();
        return;
      }

      const price = series.coordinateToPrice(yc);
      if (price == null) return;
      addLine(ticker, roundPrice(price));
    },
    [activeTool, addLine, relativeY, ticker, forceRefit]
  );

  // A fresh symbol or timeframe should start from a clean autoscale.
  useEffect(() => {
    priceOffsetRef.current = 0;
  }, [ticker, interval]);

  // Total drawings for this ticker — shown as the Draw button's badge.
  const drawingCount = lines.length + trendlines.length;

  const isUp =
    data.length >= 2 ? data[data.length - 1].close >= data[0].close : true;
  const priceChangePercent =
    data.length >= 2 && data[0].close !== 0
      ? ((data[data.length - 1].close - data[0].close) / data[0].close) * 100
      : 0;

  const intervalLabel =
    QUESTRADE_INTERVALS.find((r) => r.value === interval)?.label ?? interval;
  const isIntraday = INTRADAY_INTERVALS.has(interval);

  // Legend for the price-pane overlays so combined lines are distinguishable
  // (RSI lives in its own labelled pane, so it's omitted here).
  const legend: { label: string; color: string; dashed?: boolean }[] = [];
  if (smaCfg.enabled)
    smaCfg.periods.forEach((p, idx) =>
      legend.push({ label: `SMA ${p}`, color: maColorFor(smaCfg.colors, p, idx) })
    );
  if (emaCfg.enabled)
    emaCfg.periods.forEach((p, idx) =>
      legend.push({
        label: `EMA ${p}`,
        color: maColorFor(emaCfg.colors, p, idx),
        dashed: true,
      })
    );
  if (bollingerCfg.enabled)
    legend.push({
      label: `BB ${bollingerCfg.period}, ${bollingerCfg.mult}`,
      color: bollingerCfg.color ?? INDICATOR_COLORS.bollinger,
    });
  if (donchianCfg.enabled)
    legend.push({
      label: `DC ${donchianCfg.period}`,
      color: donchianCfg.color ?? INDICATOR_COLORS.donchian,
    });
  if (vwapCfg?.enabled)
    legend.push({
      label: vwapCfg.anchor === "session" ? "VWAP" : `VWAP ${vwapCfg.period}`,
      color: vwapCfg.color ?? INDICATOR_COLORS.vwap,
    });

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-bg-primary p-4"
          : fillHeight
            ? "flex h-full min-h-0 flex-col"
            : undefined
      }
    >
      <div
        className={`flex items-center gap-2 ${fillHeight && !fullscreen ? "mb-2 shrink-0" : "mb-3"}`}
      >
        {!hideHeading && (
          <span className="text-sm font-medium text-text-primary">
            Price Chart
          </span>
        )}

        {/* Fullscreen: company logo + name between the label and the price. */}
        {fullscreen && (
          <span className="flex items-center gap-2">
            <CompanyLogo
              ticker={ticker}
              website={website}
              className="w-6 h-6 rounded-md"
              textClassName="text-[10px]"
            />
            <span className="text-sm font-semibold text-text-primary">
              {name ?? ticker}
            </span>
          </span>
        )}

        {/* Fullscreen: current price + today's change beside the label. */}
        {fullscreen && quote && (
          <>
            <span className="text-sm font-semibold text-text-primary">
              {formatCurrency(quote.price)}
            </span>
            <span
              className="text-xs font-medium"
              style={{
                color:
                  quote.changePercent >= 0
                    ? "var(--green-primary)"
                    : "var(--red-primary)",
              }}
            >
              {formatPercent(quote.changePercent)}
            </span>
          </>
        )}

        {/* Normal view keeps the selected-range change. */}
        {!fullscreen && !loading && data.length >= 2 && (
          <span
            className="text-xs font-medium"
            style={{
              color: isUp ? "var(--green-primary)" : "var(--red-primary)",
            }}
          >
            {isUp ? "+" : ""}
            {priceChangePercent.toFixed(2)}%
          </span>
        )}

        {/* Interval dropdown (replaces the old top-right button row). */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-transparent border border-border-primary text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            {intervalLabel}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup value={interval} onValueChange={setInterval}>
              {QUESTRADE_INTERVALS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Chart type: candles vs OHLC bars. */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-transparent border border-border-primary text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            {chartType === "bars"
              ? "Bars"
              : chartType === "line"
                ? "Line"
                : "Candles"}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={chartType}
              onValueChange={(v) =>
                setChartType(v as "candles" | "bars" | "line")
              }
            >
              <DropdownMenuRadioItem value="candles">
                Candles
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="bars">
                OHLC Bars
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="line">
                Line
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Indicators (multi-select, configurable, persisted). */}
        <IndicatorsMenu isIntraday={isIntraday} />

        {/* Drawing tools: arm a horizontal line (one click) or a trendline (two
            clicks), or clear everything. The badge counts both drawing types. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border bg-transparent transition-colors cursor-pointer ${
              activeTool !== "none"
                ? "border-[#22d3ee] text-[#22d3ee]"
                : "border-border-primary text-text-secondary hover:text-text-primary"
            }`}
          >
            <PenLine className="h-3 w-3" />
            {activeTool === "trendline"
              ? pendingP1
                ? "Click end point…"
                : "Click start point…"
              : activeTool === "hline"
                ? "Click to place…"
                : "Draw"}
            {drawingCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-green-primary px-1 text-[10px] text-white">
                {drawingCount}
              </span>
            )}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => {
                setPendingP1(null);
                trendlinePrimitiveRef.current?.setDraft(null);
                setActiveTool("hline");
              }}
            >
              <Minus className="h-4 w-4" />
              Horizontal line
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setPendingP1(null);
                trendlinePrimitiveRef.current?.setDraft(null);
                setActiveTool("trendline");
              }}
            >
              <TrendingUp className="h-4 w-4" />
              Trendline
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={drawingCount === 0}
              onClick={() => clearAll(ticker)}
            >
              <X className="h-4 w-4" />
              Clear all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Candle/background colors + opacity (persisted globally). */}
        <ChartStyleMenu chartType={chartType} />

        {/* Options strike-breakdown controls (fullscreen only): OI⇄Volume toggle,
            expiry window, and a calls/puts color legend. */}
        {fullscreen && (
          <span className="ml-auto flex items-center gap-2">
            {!panelsCollapsed && (
              <>
            <span className="flex items-center gap-2 text-[11px] text-text-secondary">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-green-primary" />
                Calls
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-red-primary" />
                Puts
              </span>
            </span>

            {/* Switch the single side panel between the GEX histogram and the
                Options OI/Volume breakdown. */}
            <span className="flex items-center rounded-full border border-border-primary p-0.5 text-xs font-medium">
              {(["gex", "oi"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPanelView(v)}
                  className={`px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                    panelView === v
                      ? "bg-bg-elevated text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {v === "gex" ? "GEX" : "Options"}
                </button>
              ))}
            </span>

            {/* Net (signed diverging) vs call/put Split view, for both panels. */}
            <span className="flex items-center rounded-full border border-border-primary p-0.5 text-xs font-medium">
              {(["net", "split"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStrikeView(v)}
                  className={`px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                    strikeView === v
                      ? "bg-bg-elevated text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {v === "net" ? "Net" : "Split"}
                </button>
              ))}
            </span>

            {/* OI vs Volume only applies to the Options panel. */}
            {panelView === "oi" && (
              <span className="flex items-center rounded-full border border-border-primary p-0.5 text-xs font-medium">
                {(["oi", "volume"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setOptionsMetric(m)}
                    className={`px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                      optionsMetric === m
                        ? "bg-bg-elevated text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {m === "oi" ? "OI" : "Volume"}
                  </button>
                ))}
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-transparent border border-border-primary text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                {(() => {
                  if (selectedExpiries.length === 0) return "Expiry";
                  if (selectedExpiries.length > 1)
                    return `${selectedExpiries.length} expiries`;
                  const ex = optionsData?.expiries.find(
                    (e) => e.date === selectedExpiries[0]
                  );
                  if (!ex) return selectedExpiries[0];
                  return ex.isZeroDte ? "0DTE" : ex.label;
                })()}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                <div className="flex items-center justify-between gap-4 px-1.5 py-1 text-xs font-medium text-text-secondary">
                  <span>Expiries</span>
                  <span className="flex gap-2 text-[11px] font-normal">
                    <button
                      type="button"
                      className="text-text-secondary hover:text-text-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedExpiries(
                          (optionsData?.expiries ?? []).map((x) => x.date)
                        );
                      }}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="text-text-secondary hover:text-text-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        // Keep at least the nearest expiry so a panel always renders.
                        const first = optionsData?.expiries[0]?.date;
                        setSelectedExpiries(first ? [first] : []);
                      }}
                    >
                      Clear
                    </button>
                  </span>
                </div>
                <DropdownMenuSeparator />
                {(optionsData?.expiries ?? []).map((ex) => (
                  <DropdownMenuCheckboxItem
                    key={ex.date}
                    checked={selectedExpiries.includes(ex.date)}
                    onCheckedChange={(checked) => {
                      setSelectedExpiries((prev) => {
                        const next = checked
                          ? [...prev, ex.date]
                          : prev.filter((d) => d !== ex.date);
                        // Never end up with an empty selection.
                        return next.length > 0 ? next.sort() : prev;
                      });
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <span className="flex items-center gap-1.5">
                      {ex.label}
                      {ex.isZeroDte && (
                        <span className="rounded-sm bg-oak-300/20 px-1 text-[9px] font-semibold text-oak-300">
                          0DTE
                        </span>
                      )}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
              </>
            )}
            <button
              type="button"
              onClick={() => setPanelsCollapsed((v) => !v)}
              title={panelsCollapsed ? "Show options panels" : "Hide options panels"}
              aria-label={
                panelsCollapsed ? "Show options panels" : "Hide options panels"
              }
              className="flex items-center justify-center rounded-md border border-border-primary bg-bg-elevated/80 p-1.5 text-text-secondary backdrop-blur transition-colors hover:text-text-primary"
            >
              {panelsCollapsed ? (
                <PanelRightOpen className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </button>
          </span>
        )}
      </div>

      <div
        className={
          fullscreen
            ? "flex flex-1 gap-2 min-h-0"
            : fillHeight
              ? "flex min-h-0 flex-1"
              : undefined
        }
      >
      <div
        className={`relative ${
          fullscreen ? "flex-[2] min-w-0" : fillHeight ? "min-w-0 flex-1" : "h-[300px]"
        }`}
      >
        {/* Chart container stays mounted so lightweight-charts can attach. */}
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{
            cursor:
              activeTool !== "none"
                ? "crosshair"
                : hover
                  ? "ns-resize"
                  : trendHover
                    ? "pointer"
                    : undefined,
          }}
          onMouseMove={onChartMouseMove}
          onMouseDown={onChartMouseDown}
          onClick={onChartClick}
          onMouseLeave={() => {
            if (!dragRef.current) setHover(null);
            if (!trendDragRef.current) setTrendHover(null);
          }}
          onDoubleClick={onChartDoubleClick}
        />

        {/* ✕ delete affordance for the line under the cursor, sitting on the
            right side of the line just inside the price scale (offset by the
            axis width so it never overlaps the line's price label). */}
        {hover && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              removeLine(ticker, hover.id);
              setHover(null);
            }}
            style={{
              top: hover.y - 10,
              right: (chartRef.current?.priceScale("right").width() ?? 0) + 6,
            }}
            title="Remove line"
            aria-label="Remove line"
            className="absolute z-20 flex h-5 w-5 items-center justify-center rounded border border-border-primary bg-bg-elevated/90 text-text-secondary backdrop-blur transition-colors hover:text-red-primary"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* ✕ delete affordance for the trendline under the cursor, at its
            midpoint. */}
        {trendHover && activeTool === "none" && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              removeTrendline(ticker, trendHover.id);
              setTrendHover(null);
            }}
            style={{ top: trendHover.mid.y - 10, left: trendHover.mid.x - 10 }}
            title="Remove trendline"
            aria-label="Remove trendline"
            className="absolute z-20 flex h-5 w-5 items-center justify-center rounded border border-border-primary bg-bg-elevated/90 text-text-secondary backdrop-blur transition-colors hover:text-red-primary"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {!loading && !error && legend.length > 0 && (
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-0.5 rounded-md bg-bg-elevated/70 px-2 py-1 backdrop-blur">
            {legend.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 text-[11px] text-text-secondary"
              >
                <span
                  className="inline-block w-3"
                  style={{
                    borderTop: `2px ${item.dashed ? "dashed" : "solid"} ${item.color}`,
                  }}
                />
                {item.label}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <div className="absolute top-2 right-20 z-10 flex items-center gap-1.5">
            <button
              onClick={goToLatest}
              title="Jump to latest candle"
              aria-label="Jump to latest candle"
              className="flex items-center justify-center rounded-md border border-border-primary bg-bg-elevated/80 p-1.5 text-text-secondary backdrop-blur transition-colors hover:text-text-primary"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setFullscreen((v) => !v)}
              title={fullscreen ? "Exit full screen" : "Full screen"}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
              className="flex items-center justify-center rounded-md border border-border-primary bg-bg-elevated/80 p-1.5 text-text-secondary backdrop-blur transition-colors hover:text-text-primary"
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        )}

        {loading ? (
          <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center border border-border-primary rounded-lg bg-bg-secondary">
            <p className="text-sm text-text-secondary">Unable to load chart</p>
          </div>
        ) : data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center border border-border-primary rounded-lg bg-bg-secondary">
            <p className="text-sm text-text-secondary">No price data available</p>
          </div>
        ) : null}
      </div>

      {/* Gamma exposure by strike, diverging from a center zero line, with the
          zero-gamma flip level (fullscreen only). Sits between the chart and the
          OI/volume panel, matching the reference layout. */}
      {fullscreen && !panelsCollapsed && panelView === "gex" && (
        <div
          ref={attachPanelWheel}
          className="flex-[1] min-w-[220px] border-l border-border-primary"
        >
          {optionsData && optionsData.hasGreeks ? (
            <GexHistogram
              series={candleSeriesRef.current}
              rows={optionsData.rows}
              flip={optionsData.flip}
              netGex={optionsData.netGex}
              spot={optionsData.spot}
              view={strikeView}
              epoch={chartEpoch}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center">
              <p className="text-xs text-text-secondary">
                {optionsLoading ? "Loading GEX…" : "No gamma data"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Options strike breakdown, aligned to the price axis (fullscreen only). */}
      {fullscreen && !panelsCollapsed && panelView === "oi" && (
        <div
          ref={attachPanelWheel}
          className="relative flex-[1] min-w-[220px] border-l border-border-primary pl-1"
        >
          <StrikeHistogram
            series={candleSeriesRef.current}
            rows={optionsData?.rows ?? []}
            metric={optionsMetric}
            view={strikeView}
            spot={optionsData?.spot ?? null}
            epoch={chartEpoch}
            className="h-full w-full"
          />
          {optionsLoading && !optionsData && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-text-secondary">Loading options…</p>
            </div>
          )}
          {!optionsLoading &&
            (!optionsData || optionsData.rows.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                <p className="text-xs text-text-secondary">
                  No options data for {ticker}
                </p>
              </div>
            )}
        </div>
      )}
      </div>
    </div>
  );
}
