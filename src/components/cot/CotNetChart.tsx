"use client";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarValueLabels } from "@/components/charts/bar-value-labels";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import type { CotCategory } from "@/types";
import { formatCompactNumber, formatSignedContracts } from "@/utils/formatters";

function formatDelta(change: number): string {
  const abs = formatCompactNumber(Math.abs(change));
  return change > 0 ? `▲ ${abs}` : `▼ ${abs}`;
}

interface CotNetChartProps {
  categories: CotCategory[];
}

export function CotNetChart({ categories }: CotNetChartProps) {
  const data = categories.map((c) => ({
    name: c.name,
    net: c.net,
    netChange: c.netChange,
  }));

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-primary mb-1">
        Net Position
      </h3>
      <p className="text-xs text-text-tertiary mb-4">
        Longs minus shorts per category. Arrow = week-over-week change.
      </p>
      <BarChart
        className="h-[220px]"
        data={data}
        margin={{ top: 8, right: 88, bottom: 24, left: 184 }}
        orientation="horizontal"
        xDataKey="name"
      >
        <Grid vertical />
        <Bar dataKey="net" />
        <BarValueLabels
          color={(d) =>
            Number(d.netChange) > 0
              ? "var(--green-primary)"
              : "var(--red-primary)"
          }
          dataKey="net"
          label={(d) => {
            const delta = Number(d.netChange ?? 0);
            return delta === 0 ? null : formatDelta(delta);
          }}
        />
        <BarYAxis />
        <ChartTooltip
          rows={(point) => [
            {
              color: "var(--chart-line-primary)",
              label: "Net",
              value: `${formatSignedContracts(Number(point.net))} contracts`,
            },
          ]}
          showDatePill={false}
        />
      </BarChart>
    </div>
  );
}
