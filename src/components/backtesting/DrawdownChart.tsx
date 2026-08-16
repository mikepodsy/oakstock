"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/types/backtest";

interface DrawdownChartProps {
  equity: EquityPoint[];
  height?: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated p-3 shadow-lg">
      <p className="mb-1 text-xs text-text-secondary">
        {format(new Date(label), "MMM d, yyyy")}
      </p>
      <p className="font-financial text-sm text-text-primary">
        {(payload[0].value * 100).toFixed(2)}%
      </p>
    </div>
  );
}

/** Underwater curve: how far below the running peak the strategy sat, always ≤ 0. */
export function DrawdownChart({ equity, height = 160 }: DrawdownChartProps) {
  const data = useMemo(
    () => equity.map((p) => ({ date: p.date, drawdown: p.drawdown ?? 0 })),
    [equity]
  );

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer height={height} width="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="drawdownFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--red-primary)" stopOpacity={0} />
            <stop offset="100%" stopColor="var(--red-primary)" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="date"
          minTickGap={48}
          stroke="var(--text-tertiary)"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => format(new Date(v), "MMM ''yy")}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          stroke="var(--text-tertiary)"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          dataKey="drawdown"
          fill="url(#drawdownFill)"
          stroke="var(--red-primary)"
          strokeWidth={1.5}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
