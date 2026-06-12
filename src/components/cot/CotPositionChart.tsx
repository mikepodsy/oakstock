"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { CotCategory } from "@/types";
import { formatCompactNumber, formatContracts } from "@/utils/formatters";

interface CotPositionChartProps {
  categories: CotCategory[];
  title: string;
}

const tooltipStyle = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border-primary)",
  borderRadius: 8,
  fontSize: 12,
};

export function CotPositionChart({ categories, title }: CotPositionChartProps) {
  const data = categories.map((c) => ({
    name: c.name,
    Longs: c.longs,
    Shorts: c.shorts,
  }));

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-primary mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 4 }}
          barSize={9}
          barGap={2}
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
            formatter={(v, name) => [formatContracts(Number(v)), String(name)]}
            cursor={{ fill: "var(--bg-tertiary)", opacity: 0.4 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => (
              <span style={{ color: "var(--text-secondary)" }}>{value}</span>
            )}
          />
          <Bar dataKey="Longs" fill="var(--green-primary)" radius={[0, 3, 3, 0]} />
          <Bar dataKey="Shorts" fill="var(--red-primary)" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
