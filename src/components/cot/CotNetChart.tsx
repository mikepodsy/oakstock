"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";
import type { CotCategory } from "@/types";
import { formatCompactNumber, formatSignedContracts } from "@/utils/formatters";

function formatDelta(change: number): string {
  const abs = formatCompactNumber(Math.abs(change));
  return change > 0 ? `▲ ${abs}` : `▼ ${abs}`;
}

const tooltipStyle = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border-primary)",
  borderRadius: 8,
  fontSize: 12,
};

interface LabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
  index?: number;
}

function DeltaLabel({ x = 0, y = 0, width = 0, height = 0, value = 0, index = 0, categories }: LabelProps & { categories: CotCategory[] }) {
  const cat = categories[index];
  if (!cat) return null;
  const delta = cat.netChange;
  if (delta === 0) return null;

  const isPositive = delta > 0;
  const labelX = value >= 0 ? x + width + 6 : x + width - 6;
  const anchor = value >= 0 ? "start" : "end";

  return (
    <text
      x={labelX}
      y={y + height / 2}
      dy={4}
      textAnchor={anchor}
      fontSize={11}
      fontFamily="monospace"
      fill={isPositive ? "var(--green-primary)" : "var(--red-primary)"}
    >
      {formatDelta(delta)}
    </text>
  );
}

interface CotNetChartProps {
  categories: CotCategory[];
}

export function CotNetChart({ categories }: CotNetChartProps) {
  const data = categories.map((c) => ({
    name: c.name,
    net: c.net,
  }));

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-primary mb-1">Net Position</h3>
      <p className="text-xs text-text-tertiary mb-4">Longs minus shorts per category. Arrow = week-over-week change.</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 80, bottom: 0, left: 4 }}
          barSize={14}
        >
          <CartesianGrid horizontal={false} stroke="var(--border-primary)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={formatCompactNumber}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [`${formatSignedContracts(Number(v))} contracts`, "Net"]}
            cursor={{ fill: "var(--bg-tertiary)", opacity: 0.4 }}
          />
          <Bar dataKey="net" radius={[0, 3, 3, 0]}>
            {categories.map((c) => (
              <Cell
                key={c.name}
                fill={c.net >= 0 ? "var(--green-primary)" : "var(--red-primary)"}
              />
            ))}
            <LabelList
              dataKey="net"
              content={(props) => (
                <DeltaLabel {...(props as LabelProps)} categories={categories} />
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
