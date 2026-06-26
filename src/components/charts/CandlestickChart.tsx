"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
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
import { fetchQuestradeCandles } from "@/services/questrade";
import { QUESTRADE_INTERVALS } from "@/utils/constants";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { useThemeStore } from "@/stores/themeStore";
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

  const containerRef = useRef<HTMLDivElement>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const colorsRef = useRef({ up: "#22C55E", down: "#EF4444" });

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
        // Pin data to both edges so zooming/scrolling out never leaves empty
        // space before the first or after the last candle.
        fixLeftEdge: true,
        fixRightEdge: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
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
    };
  }, [theme]);

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
  }, [data, theme, interval]);

  const isUp =
    data.length >= 2 ? data[data.length - 1].close >= data[0].close : true;
  const priceChangePercent =
    data.length >= 2 && data[0].close !== 0
      ? ((data[data.length - 1].close - data[0].close) / data[0].close) * 100
      : 0;

  const intervalLabel =
    QUESTRADE_INTERVALS.find((r) => r.value === interval)?.label ?? interval;

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
      </div>

      <div className={`relative ${fullscreen ? "flex-1" : "h-[300px]"}`}>
        {/* Chart container stays mounted so lightweight-charts can attach. */}
        <div ref={containerRef} className="h-full w-full" />

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
