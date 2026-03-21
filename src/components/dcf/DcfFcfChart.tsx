"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCompactNumber, formatCurrency } from "@/utils/formatters";

interface DcfFcfChartProps {
  data: Array<{ year: number; fcf: number }>;
  phase1Years: number;
}

export function DcfFcfChart({ data, phase1Years }: DcfFcfChartProps) {
  const chartData = data.map((d) => ({
    label: `Y${d.year}`,
    value: d.fcf,
    phase: d.year <= phase1Years ? "Phase 1" : "Phase 2",
  }));

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 mb-6">
      <h2 className="text-lg font-medium text-text-primary mb-1">
        Projected Free Cash Flow
      </h2>
      <p className="text-xs text-text-secondary mb-4">
        Phase 1 (high growth) &middot; Phase 2 (stable growth)
      </p>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-primary)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCompactNumber(v)}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [formatCurrency(Number(v)), "FCF"]}
            labelFormatter={(l) => `Year ${String(l).replace("Y", "")}`}
          />
          {phase1Years < data.length && (
            <ReferenceLine
              x={`Y${phase1Years}`}
              stroke="var(--text-tertiary)"
              strokeDasharray="4 4"
              label={{
                value: "Phase 2",
                position: "top",
                fill: "var(--text-tertiary)",
                fontSize: 10,
              }}
            />
          )}
          <Bar
            dataKey="value"
            fill="var(--green-primary)"
            radius={[3, 3, 0, 0]}
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
