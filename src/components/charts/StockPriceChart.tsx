"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  useXAxisScale,
  useYAxisScale,
  usePlotArea,
} from "recharts";
import { TimeRangePicker } from "./TimeRangePicker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatCompactNumber, formatDate } from "@/utils/formatters";
import { fetchHistory } from "@/services/yahooFinance";
import { format } from "date-fns";
import type { HistoricalDataPoint } from "@/types";

interface StockPriceChartProps {
  ticker: string;
}

const UP_COLOR = "var(--green-primary)";
const DOWN_COLOR = "var(--red-primary)";

// Renders OHLC candlesticks using the chart's computed axis scales (recharts 3
// hooks), so wicks and bodies stay pixel-accurate regardless of the price range
// — including flat/doji bars where open === close.
function Candles({ data }: { data: HistoricalDataPoint[] }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plotArea = usePlotArea();

  if (!xScale || !yScale || !plotArea || data.length === 0) return null;

  const slot = plotArea.width / data.length;
  const candleWidth = Math.max(1, Math.min(slot * 0.6, 14));

  return (
    <g>
      {data.map((d, i) => {
        const open = d.open ?? d.close;
        const high = d.high ?? d.close;
        const low = d.low ?? d.close;
        const close = d.close;

        const xCenter = xScale(d.date, { position: "middle" });
        const yHigh = yScale(high);
        const yLow = yScale(low);
        const yOpen = yScale(open);
        const yClose = yScale(close);
        if (
          xCenter == null ||
          yHigh == null ||
          yLow == null ||
          yOpen == null ||
          yClose == null
        ) {
          return null;
        }

        const isUp = close >= open;
        const color = isUp ? UP_COLOR : DOWN_COLOR;
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));

        return (
          <g key={`${d.date}-${i}`} stroke={color} fill={color}>
            {/* high–low wick */}
            <line x1={xCenter} x2={xCenter} y1={yHigh} y2={yLow} strokeWidth={1} />
            {/* open–close body */}
            <rect
              x={xCenter - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
            />
          </g>
        );
      })}
    </g>
  );
}

function CandleTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistoricalDataPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const rows: Array<[string, number | undefined]> = [
    ["Open", d.open],
    ["High", d.high],
    ["Low", d.low],
    ["Close", d.close],
  ];
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs text-text-tertiary mb-1">{formatDate(d.date)}</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">{label}</span>
          <span className="text-xs font-financial text-text-primary ml-auto">
            {value != null ? formatCurrency(value) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StockPriceChart({ ticker }: StockPriceChartProps) {
  const [period, setPeriod] = useState("3m");
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchHistory(ticker, period)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load chart");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticker, period]);

  const isUp =
    data.length >= 2 ? data[data.length - 1].close >= data[0].close : true;

  const priceChange =
    data.length >= 2 ? data[data.length - 1].close - data[0].close : 0;
  const priceChangePercent =
    data.length >= 2 && data[0].close !== 0
      ? (priceChange / data[0].close) * 100
      : 0;

  // Explicit y-domain that covers the full high–low range so wicks never clip.
  const yDomain: [number, number] | undefined = (() => {
    if (data.length === 0) return undefined;
    let min = Infinity;
    let max = -Infinity;
    for (const d of data) {
      min = Math.min(min, d.low ?? d.close);
      max = Math.max(max, d.high ?? d.close);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
    const pad = (max - min) * 0.05 || max * 0.01 || 1;
    return [min - pad, max + pad];
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            Price Chart
          </span>
          {!loading && data.length >= 2 && (
            <span
              className="text-xs font-medium"
              style={{ color: isUp ? UP_COLOR : DOWN_COLOR }}
            >
              {isUp ? "+" : ""}
              {priceChangePercent.toFixed(2)}%
            </span>
          )}
        </div>
        <TimeRangePicker selected={period} onSelect={setPeriod} />
      </div>

      {loading ? (
        <Skeleton className="h-[300px] w-full rounded-lg" />
      ) : error ? (
        <div className="h-[300px] flex items-center justify-center border border-border-primary rounded-lg">
          <p className="text-sm text-text-secondary">Unable to load chart</p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center border border-border-primary rounded-lg">
          <p className="text-sm text-text-secondary">No price data available</p>
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(v: number) => `$${formatCompactNumber(v)}`}
                tickLine={false}
                axisLine={false}
                width={60}
                domain={yDomain ?? ["auto", "auto"]}
              />
              <Tooltip content={<CandleTooltip />} cursor={{ stroke: "var(--border-primary)" }} />
              {/* Hidden bar: anchors the categorical band scale used for candle
                  x-positions and drives tooltip hit-testing. */}
              <Bar dataKey="close" fillOpacity={0} isAnimationActive={false} />
              <Candles data={data} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
