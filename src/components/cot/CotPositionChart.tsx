"use client";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import {
  Legend,
  LegendItem,
  LegendLabel,
  LegendMarker,
} from "@/components/charts/legend";
import { ChartTooltip } from "@/components/charts/tooltip";
import type { CotCategory } from "@/types";
import { formatContracts } from "@/utils/formatters";

interface CotPositionChartProps {
  categories: CotCategory[];
  title: string;
}

const LONGS_COLOR = "var(--chart-line-primary)";
const SHORTS_COLOR = "var(--chart-line-secondary)";

export function CotPositionChart({ categories, title }: CotPositionChartProps) {
  const data = categories.map((c) => ({
    name: c.name,
    Longs: c.longs,
    Shorts: c.shorts,
  }));

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-primary mb-4">{title}</h3>
      <Legend
        className="mb-2 flex-row flex-wrap gap-x-4 gap-y-1"
        items={[
          { label: "Longs", value: 0, color: LONGS_COLOR },
          { label: "Shorts", value: 0, color: SHORTS_COLOR },
        ]}
      >
        <LegendItem>
          <LegendMarker />
          <LegendLabel />
        </LegendItem>
      </Legend>
      <BarChart
        className="h-[280px]"
        data={data}
        margin={{ top: 8, right: 24, bottom: 24, left: 184 }}
        orientation="horizontal"
        xDataKey="name"
      >
        <Grid vertical />
        <Bar dataKey="Longs" fill={LONGS_COLOR} />
        <Bar dataKey="Shorts" fill={SHORTS_COLOR} />
        <BarYAxis />
        <ChartTooltip
          rows={(point) => [
            {
              color: LONGS_COLOR,
              label: "Longs",
              value: formatContracts(Number(point.Longs)),
            },
            {
              color: SHORTS_COLOR,
              label: "Shorts",
              value: formatContracts(Number(point.Shorts)),
            },
          ]}
          showDatePill={false}
        />
      </BarChart>
    </div>
  );
}
