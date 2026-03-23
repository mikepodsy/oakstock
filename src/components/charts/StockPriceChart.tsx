"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { TimeRangePicker } from "./TimeRangePicker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/formatters";
import { fetchHistory } from "@/services/yahooFinance";
import { format } from "date-fns";
import type { HistoricalDataPoint } from "@/types";

interface StockPriceChartProps {
  ticker: string;
}

function StockTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number; dataKey: string }>;
}) {
  if (!active || !payload || !label) return null;
  const price = payload.find((p) => p.dataKey === "close")?.value ?? null;
  return (
    <ChartTooltip
      active={active}
      label={label}
      entries={[{ name: "Price", value: price, color: "var(--green-primary)" }]}
    />
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

    return () => { cancelled = true; };
  }, [ticker, period]);

  const isUp =
    data.length >= 2 ? data[data.length - 1].close >= data[0].close : true;
  const areaColor = isUp ? "var(--green-primary)" : "var(--red-primary)";

  const priceChange =
    data.length >= 2 ? data[data.length - 1].close - data[0].close : 0;
  const priceChangePercent =
    data.length >= 2 && data[0].close !== 0
      ? (priceChange / data[0].close) * 100
      : 0;

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
              style={{ color: areaColor }}
            >
              {isUp ? "+" : ""}
              {priceChangePercent.toFixed(2)}%
            </span>
          )}
        </div>
        <TimeRangePicker selected={period} onSelect={setPeriod} />
      </div>

      {loading ? (
        <Skeleton className="h-[200px] w-full rounded-lg" />
      ) : error ? (
        <div className="h-[200px] flex items-center justify-center border border-border-primary rounded-lg">
          <p className="text-sm text-text-secondary">Unable to load chart</p>
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={areaColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={areaColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(v: number) => `$${formatCompactNumber(v)}`}
                tickLine={false}
                axisLine={false}
                width={60}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<StockTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={areaColor}
                strokeWidth={2}
                fill={`url(#grad-${ticker})`}
                isAnimationActive={true}
                animationDuration={600}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
