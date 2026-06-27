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
} from "lightweight-charts";
import {
  ChevronsRight,
  ChevronDown,
  Maximize2,
  Minimize2,
  Minus,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { IndicatorsMenu } from "./IndicatorsMenu";
import { ChartStyleMenu } from "./ChartStyleMenu";
import { SessionBackgroundPrimitive } from "./sessionBackground";
import { fetchQuestradeCandles } from "@/services/questrade";
import { QUESTRADE_INTERVALS } from "@/utils/constants";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { useThemeStore } from "@/stores/themeStore";
import { useChartStyleStore, withAlpha } from "@/stores/chartStyleStore";
import { useIndicatorStore } from "@/stores/indicatorStore";
import { useDrawingStore } from "@/stores/drawingStore";
import {
  sma as smaCalc,
  ema as emaCalc,
  bollinger as bollingerCalc,
  donchian as donchianCalc,
  rsi as rsiCalc,
  sessionSegments,
  type LinePoint,
} from "@/utils/indicators";
import { maColorFor, INDICATOR_COLORS } from "@/utils/indicatorConfig";
import type { QuestradeCandle } from "@/types";

interface CandlestickChartProps {
  ticker: string;
  name?: string;
  website?: string;
}

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
// Stable empty reference so the store selector doesn't churn when a ticker has
// no lines yet (avoids re-render loops).
const EMPTY_LINES: { id: string; price: number }[] = [];
// How close (px) the cursor must be to a line to grab it.
const LINE_HIT_PX = 6;

// Round a clicked/dragged price to a sensible precision for its magnitude.
function roundPrice(p: number): number {
  const decimals = Math.abs(p) >= 1 ? 2 : 4;
  return Number(p.toFixed(decimals));
}

export function CandlestickChart({
  ticker,
  name,
  website,
}: CandlestickChartProps) {
  const [interval, setInterval] = useState("OneDay");
  const [chartType, setChartType] = useState<"candles" | "bars" | "line">(
    "candles"
  );
  const [data, setData] = useState<QuestradeCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // Latest price + today's change (last daily close vs prior daily close).
  // Fetched independently of the chart interval so it stays a true day change.
  const [quote, setQuote] = useState<{
    price: number;
    changePercent: number;
  } | null>(null);
  const theme = useThemeStore((s) => s.theme);
  // Candle/background style config (persisted globally). Applied live to the
  // existing chart via applyOptions, so edits don't recreate the canvas.
  const chartStyle = useChartStyleStore();

  // Indicator config (persisted globally). Selected as individual slices so each
  // effect only re-runs when its own indicator changes.
  const smaCfg = useIndicatorStore((s) => s.sma);
  const emaCfg = useIndicatorStore((s) => s.ema);
  const bollingerCfg = useIndicatorStore((s) => s.bollinger);
  const donchianCfg = useIndicatorStore((s) => s.donchian);
  const rsiCfg = useIndicatorStore((s) => s.rsi);
  const volumeCfg = useIndicatorStore((s) => s.volume);
  const sessionsCfg = useIndicatorStore((s) => s.sessions);

  // User-drawn horizontal lines for this ticker (persisted, per-symbol).
  const linesRaw = useDrawingStore((s) => s.lines[ticker]);
  const lines = linesRaw ?? EMPTY_LINES;
  const addLine = useDrawingStore((s) => s.addLine);
  const moveLine = useDrawingStore((s) => s.moveLine);
  const removeLine = useDrawingStore((s) => s.removeLine);
  const clearLines = useDrawingStore((s) => s.clearLines);

  // Draw-line tool state: hover tracks the line under the cursor (for the drag
  // handle + ✕ delete affordance). New lines are added by double-clicking.
  const [hover, setHover] = useState<{ id: string; y: number } | null>(null);
  const priceLineRefs = useRef<Map<string, IPriceLine>>(new Map());
  const dragRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const candleSeriesRef = useRef<ISeriesApi<
    "Candlestick" | "Bar" | "Line"
  > | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const colorsRef = useRef({ up: "#22C55E", down: "#EF4444" });
  // Dynamically added overlay/oscillator line series, torn down + rebuilt on change.
  const indicatorSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const sessionPrimitiveRef = useRef<SessionBackgroundPrimitive | null>(null);

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

  // Jump back to the most recent candle.
  const goToLatest = useCallback(() => {
    chartRef.current?.timeScale().scrollToRealTime();
  }, []);

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
    const style = useChartStyleStore.getState();
    const up = withAlpha(style.body.up, style.candleUpOpacity);
    const down = withAlpha(style.body.down, style.candleDownOpacity);
    const lineColor = cssVar("--text-primary", "#F0EDE8");
    const text = cssVar("--text-tertiary", "#8b8b8b");
    const bg = withAlpha(style.background, style.backgroundOpacity);
    const grid = cssVar("--border-primary", "#222222");
    // Volume bars track the candle body colors (opaque, regardless of body fill
    // opacity) so they stay legible.
    colorsRef.current = { up: style.body.up, down: style.body.down };

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

    const candleSeries =
      chartType === "bars"
        ? chart.addSeries(BarSeries, { upColor: up, downColor: down })
        : chartType === "line"
          ? chart.addSeries(LineSeries, {
              color: lineColor,
              lineWidth: 2,
              priceLineVisible: false,
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

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      // The removed chart took its indicator series + session primitive with it.
      indicatorSeriesRef.current = [];
      sessionPrimitiveRef.current = null;
    };
  }, [theme, chartType]);

  // Apply candle/background style live to the existing chart + series. Runs on
  // any style change (and after the chart is recreated, since the candle series
  // ref changes). No recreation → no flicker, viewport preserved.
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart) return;

    const up = withAlpha(chartStyle.body.up, chartStyle.candleUpOpacity);
    const down = withAlpha(chartStyle.body.down, chartStyle.candleDownOpacity);
    colorsRef.current = { up: chartStyle.body.up, down: chartStyle.body.down };

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
          upColor: up,
          downColor: down,
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

    const { up, down } = colorsRef.current;

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
        color: c.close >= c.open ? up : down,
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
      const series = chart.addSeries(
        LineSeries,
        {
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
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
    volumeCfg,
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

  // Cursor y relative to the chart container's top, matching the coordinate
  // space lightweight-charts uses for priceToCoordinate / coordinateToPrice.
  const relativeY = useCallback((clientY: number): number | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? clientY - rect.top : null;
  }, []);

  // Hover detection: highlight the nearest line within the grab threshold.
  const onChartMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) return; // drag has its own window listener
      const series = candleSeriesRef.current;
      const yc = relativeY(e.clientY);
      if (yc == null || !series) {
        setHover((prev) => (prev ? null : prev));
        return;
      }
      let best: { id: string; y: number } | null = null;
      let bestDist = LINE_HIT_PX;
      for (const line of lines) {
        const coord = series.priceToCoordinate(line.price);
        if (coord == null) continue;
        const d = Math.abs(coord - yc);
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
    },
    [lines, relativeY]
  );

  // Press on a hovered line to start dragging it vertically. Live-updates the
  // price line via applyOptions and commits to the store on release. Pan/zoom
  // is suspended for the duration so the drag doesn't scroll the chart.
  const onChartMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!hover) return;
      const series = candleSeriesRef.current;
      const chart = chartRef.current;
      if (!series || !chart) return;
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
    },
    [hover, lines, moveLine, relativeY, ticker]
  );

  // Double-click anywhere on the chart to drop a new horizontal line there.
  const onChartDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const series = candleSeriesRef.current;
      const yc = relativeY(e.clientY);
      if (yc == null || !series) return;
      const price = series.coordinateToPrice(yc);
      if (price == null) return;
      addLine(ticker, roundPrice(price));
    },
    [addLine, relativeY, ticker]
  );

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

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-bg-primary p-4"
          : undefined
      }
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-text-primary">
          Price Chart
        </span>

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

        {/* Candle/background colors + opacity (persisted globally). */}
        <ChartStyleMenu />

        {/* Horizontal lines: double-click the chart to add one. This button
            shows the count and clears them all. */}
        <button
          type="button"
          onClick={() => lines.length > 0 && clearLines(ticker)}
          disabled={lines.length === 0}
          title={
            lines.length > 0
              ? "Clear all lines (double-click the chart to add one)"
              : "Double-click the chart to add a horizontal line"
          }
          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-border-primary bg-transparent text-text-secondary transition-colors enabled:hover:text-text-primary enabled:cursor-pointer disabled:opacity-60"
        >
          <Minus className="h-3 w-3" />
          Lines
          {lines.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-green-primary px-1 text-[10px] text-white">
              {lines.length}
            </span>
          )}
        </button>
      </div>

      <div className={`relative ${fullscreen ? "flex-1" : "h-[300px]"}`}>
        {/* Chart container stays mounted so lightweight-charts can attach. */}
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{ cursor: hover ? "ns-resize" : undefined }}
          onMouseMove={onChartMouseMove}
          onMouseDown={onChartMouseDown}
          onMouseLeave={() => {
            if (!dragRef.current) setHover(null);
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
    </div>
  );
}
