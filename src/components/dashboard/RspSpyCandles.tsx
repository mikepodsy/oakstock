"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { Skeleton } from "@/components/ui/skeleton";
import type { RatioCandle } from "@/lib/ratioCandles";

const RANGES = [
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "5Y", value: "5y" },
] as const;

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function RspSpyCandles() {
  const [range, setRange] = useState<string>("1y");
  const [candles, setCandles] = useState<RatioCandle[]>([]);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const fetchCandles = useCallback(async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market/rsp-spy-candles?range=${r}`);
      if (!res.ok) throw new Error("candles");
      const data: { candles?: RatioCandle[] } = await res.json();
      setCandles(data.candles ?? []);
    } catch {
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch candles whenever the range changes.
  useEffect(() => {
    fetchCandles(range);
  }, [fetchCandles, range]);

  // Create the chart once.
  useEffect(() => {
    if (!containerRef.current) return;
    const grid = cssVar("--border-primary", "#222222");
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        textColor: cssVar("--text-tertiary", "#8b8b8b"),
        background: { type: ColorType.Solid, color: cssVar("--bg-secondary", "#111111") },
        fontSize: 11,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, fixLeftEdge: true },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: cssVar("--green-primary", "#22C55E"),
      downColor: cssVar("--red-primary", "#EF4444"),
      borderUpColor: cssVar("--green-primary", "#22C55E"),
      borderDownColor: cssVar("--red-primary", "#EF4444"),
      wickUpColor: cssVar("--green-primary", "#22C55E"),
      wickDownColor: cssVar("--red-primary", "#EF4444"),
      priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push data to the series when it arrives.
  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-display text-text-primary">RSP / SPY (Breadth)</h3>
        <div className="flex gap-0.5 rounded-lg bg-bg-tertiary p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2 py-0.5 text-[10px] rounded-md transition-colors ${
                range === r.value
                  ? "bg-bg-secondary text-text-primary shadow-sm"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[300px]">
        {loading && candles.length === 0 && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
