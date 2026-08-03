"use client";

import { BandReferenceArea } from "@/components/charts/band-reference-area";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { YAxis } from "@/components/charts/y-axis";
import { formatCompactNumber, formatCurrency } from "@/utils/formatters";

interface DcfFcfChartProps {
  data: Array<{ year: number; fcf: number }>;
  phase1Years: number;
}

export function DcfFcfChart({ data, phase1Years }: DcfFcfChartProps) {
  const chartData = data.map((d) => ({
    label: `Y${d.year}`,
    year: d.year,
    value: d.fcf,
  }));

  const hasPhase2 = phase1Years < data.length;

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 mb-6">
      <h2 className="text-lg font-medium text-text-primary mb-1">
        Projected Free Cash Flow
      </h2>
      <p className="text-xs text-text-secondary mb-4">
        Phase 1 (high growth) &middot; Phase 2 (stable growth)
      </p>

      <BarChart
        className="h-[260px]"
        data={chartData}
        margin={{ top: 16, right: 8, bottom: 24, left: 56 }}
        xDataKey="label"
      >
        <Grid horizontal />
        {hasPhase2 ? (
          <BandReferenceArea label="Phase 2" x1={`Y${phase1Years + 1}`} />
        ) : null}
        <Bar dataKey="value" />
        <BarXAxis />
        <YAxis formatValue={formatCompactNumber} />
        <ChartTooltip
          rows={(point) => [
            {
              color: "var(--chart-line-primary)",
              label: `Year ${String(point.year)}`,
              value: formatCurrency(Number(point.value)),
            },
          ]}
          showDatePill={false}
        />
      </BarChart>
    </div>
  );
}
