"use client";

import {
  AreaChart,
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
import { format } from "date-fns";

interface CombinedChartProps {
  data: { date: string; value: number }[];
  period: string;
  onPeriodChange: (period: string) => void;
  loading: boolean;
}

function CombinedTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number }>;
}) {
  if (!active || !payload || !label) return null;

  return (
    <ChartTooltip
      active={active}
      label={label}
      entries={[
        {
          name: "Total Value",
          value: payload[0]?.value ?? null,
          color: "var(--green-primary)",
        },
      ]}
    />
  );
}

export function CombinedChart({
  data,
  period,
  onPeriodChange,
  loading,
}: CombinedChartProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base text-text-primary">
          Portfolio Performance
        </h3>
        <TimeRangePicker selected={period} onSelect={onPeriodChange} />
      </div>

      {loading ? (
        <Skeleton className="h-[250px] md:h-[350px] w-full rounded-lg" />
      ) : (
        <div className="h-[250px] md:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient
                  id="combinedGreenGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--green-primary)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--green-primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-primary)"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                tickFormatter={(date: string) => format(new Date(date), "MMM d")}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                tickFormatter={(v: number) => `$${formatCompactNumber(v)}`}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip content={<CombinedTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--green-primary)"
                strokeWidth={2}
                fill="url(#combinedGreenGradient)"
                isAnimationActive={true}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
