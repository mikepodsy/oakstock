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
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { ChevronsRight, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { IndicatorsMenu } from "./IndicatorsMenu";
import { SessionBackgroundPrimitive } from "./sessionBackground";
import { fetchQuestradeCandles } from "@/services/questrade";
import { QUESTRADE_INTERVALS } from "@/utils/constants";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { useThemeStore } from "@/stores/themeStore";
import { useIndicatorStore } from "@/stores/indicatorStore";
import {
  sma as smaCalc,
  ema as emaCalc,
  bollinger as bollingerCalc,
  donchian as donchianCalc,
  rsi as rsiCalc,
  sessionSegments,
  type LinePoint,
} from "@/utils/indicators";
import { maColor, INDICATOR_COLORS } from "@/utils/indicatorConfig";
import type { QuestradeCandle } from "@/types";

interface CandlestickChartProps {
  ticker: string;
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

export function CandlestickChart({ ticker }: CandlestickChartProps) {
  const [interval, setInterval] = useState("OneDay");
  const [chartType, setChartType] = useState<"candles" | "bars">("candles");
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

  // Indicator config (persisted globally). Selected as individual slices so each
  // effect only re-runs when its own indicator changes.
  const smaCfg = useIndicatorStore((s) => s.sma);
  const emaCfg = useIndicatorStore((s) => s.ema);
  const bollingerCfg = useIndicatorStore((s) => s.bollinger);
  const donchianCfg = useIndicatorStore((s) => s.donchian);
  const rsiCfg = useIndicatorStore((s) => s.rsi);
  const volumeCfg = useIndicatorStore((s) => s.volume);
  const sessionsCfg = useIndicatorStore((s) => s.sessions);

  const containerRef = useRef<HTMLDivElement>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick" | "Bar"> | null>(null);
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

    const up = cssVar("--green-primary", "#22C55E");
    const down = cssVar("--red-primary", "#EF4444");
    const text = cssVar("--text-tertiary", "#8b8b8b");
    const bg = cssVar("--bg-secondary", "#000000");
    const grid = cssVar("--border-primary", "#222222");
    colorsRef.current = { up, down };

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { textColor: text, background: { type: ColorType.Solid, color: bg } },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
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
        : chart.addSeries(CandlestickSeries, {
            upColor: up,
            downColor: down,
            borderVisible: false,
            wickUpColor: up,
            wickDownColor: down,
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

  // Push data into the series when it (or the recreated chart) changes.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart || data.length === 0) return;

    const { up, down } = colorsRef.current;

    candleSeries.setData(
      data.map((c) => ({
        time: (Date.parse(c.time) / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

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
        addLine(smaCalc(data, p), { color: maColor(idx) })
      );
    }
    if (emaCfg.enabled) {
      emaCfg.periods.forEach((p, idx) =>
        addLine(emaCalc(data, p), {
          color: maColor(idx),
          lineStyle: LineStyle.Dashed,
        })
      );
    }
    if (bollingerCfg.enabled) {
      const b = bollingerCalc(data, bollingerCfg.period, bollingerCfg.mult);
      addLine(b.upper, { color: INDICATOR_COLORS.bollinger, lineWidth: 1 });
      addLine(b.middle, {
        color: INDICATOR_COLORS.bollinger,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
      });
      addLine(b.lower, { color: INDICATOR_COLORS.bollinger, lineWidth: 1 });
    }
    if (donchianCfg.enabled) {
      const d = donchianCalc(data, donchianCfg.period);
      addLine(d.upper, { color: INDICATOR_COLORS.donchian, lineWidth: 1 });
      addLine(d.middle, {
        color: INDICATOR_COLORS.donchian,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
      });
      addLine(d.lower, { color: INDICATOR_COLORS.donchian, lineWidth: 1 });
    }
    if (rsiCfg.enabled) {
      const line = addLine(
        rsiCalc(data, rsiCfg.period),
        { color: INDICATOR_COLORS.rsi, lineWidth: 2 },
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
      legend.push({ label: `SMA ${p}`, color: maColor(idx) })
    );
  if (emaCfg.enabled)
    emaCfg.periods.forEach((p, idx) =>
      legend.push({ label: `EMA ${p}`, color: maColor(idx), dashed: true })
    );
  if (bollingerCfg.enabled)
    legend.push({
      label: `BB ${bollingerCfg.period}, ${bollingerCfg.mult}`,
      color: INDICATOR_COLORS.bollinger,
    });
  if (donchianCfg.enabled)
    legend.push({
      label: `DC ${donchianCfg.period}`,
      color: INDICATOR_COLORS.donchian,
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
            {chartType === "bars" ? "Bars" : "Candles"}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={chartType}
              onValueChange={(v) => setChartType(v as "candles" | "bars")}
            >
              <DropdownMenuRadioItem value="candles">
                Candles
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="bars">
                OHLC Bars
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Indicators (multi-select, configurable, persisted). */}
        <IndicatorsMenu isIntraday={isIntraday} />
      </div>

      <div className={`relative ${fullscreen ? "flex-1" : "h-[300px]"}`}>
        {/* Chart container stays mounted so lightweight-charts can attach. */}
        <div ref={containerRef} className="h-full w-full" />

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
