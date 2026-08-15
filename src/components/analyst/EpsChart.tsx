"use client";

import { useMemo, useState } from "react";
import { Bar } from "@/components/charts/bar";
import { BandReferenceArea } from "@/components/charts/band-reference-area";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import {
  Legend,
  LegendItem,
  LegendLabel,
  LegendMarker,
} from "@/components/charts/legend";
import { ChartTooltip } from "@/components/charts/tooltip";
import { YAxis } from "@/components/charts/y-axis";
import { formatFiscalPeriod } from "@/utils/formatters";
import type { EpsPeriod } from "@/types";

interface EpsChartProps {
  annual: EpsPeriod[];
  quarterly: EpsPeriod[];
}

const REPORTED_COLOR = "var(--chart-line-primary)";
const ESTIMATE_COLOR = "var(--text-tertiary)";

type Mode = "annual" | "quarterly";

function fmtEps(v: number): string {
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;
}

export function EpsChart({ annual, quarterly }: EpsChartProps) {
  // Quarterly is the richer series — it carries the estimate each quarter was
  // actually measured against, where annual only has forward consensus.
  const [mode, setMode] = useState<Mode>(
    quarterly.length > 0 ? "quarterly" : "annual"
  );

  const periods = mode === "annual" ? annual : quarterly;

  const { rows, forecastFrom } = useMemo(() => {
    const rows = periods.map((p) => ({
      label: p.label,
      Reported: p.actual,
      Estimate: p.estimate,
    }));
    // Everything from the first unreported period on is forecast, and gets
    // shaded so an estimate is never mistaken for a result.
    const firstForecast = periods.findIndex((p) => p.actual == null);
    return {
      rows,
      forecastFrom: firstForecast >= 0 ? periods[firstForecast].label : null,
    };
  }, [periods]);

  if (periods.length === 0) return null;

  const hasBoth = periods.some((p) => p.actual != null && p.estimate != null);

  return (
    <div className="min-w-0 rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-text-primary">
          EPS <span className="text-text-tertiary">· diluted</span>
        </h3>

        {annual.length > 0 && quarterly.length > 0 && (
          <div className="flex items-center gap-2">
            {(["annual", "quarterly"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  m === mode
                    ? "bg-green-primary text-bg-primary"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                }`}
              >
                {m === "annual" ? "Annual" : "Quarterly"}
              </button>
            ))}
          </div>
        )}
      </div>

      <Legend
        className="mb-2 flex-row flex-wrap gap-x-4 gap-y-1"
        items={[
          { label: "Reported", value: 0, color: REPORTED_COLOR },
          { label: "Estimate", value: 0, color: ESTIMATE_COLOR },
        ]}
      >
        <LegendItem>
          <LegendMarker />
          <LegendLabel />
        </LegendItem>
      </Legend>

      {/* Scrolls on its own when the bands get tight, so the page never does. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <BarChart
          className="h-[200px] min-w-[420px]"
          data={rows}
          margin={{ top: 12, right: 8, bottom: 28, left: 52 }}
          xDataKey="label"
        >
          <Grid horizontal />
          {/* Before the bars, so they paint over the band. */}
          {forecastFrom && (
            <BandReferenceArea
              label="FORECAST"
              x1={forecastFrom}
              x2={periods[periods.length - 1].label}
            />
          )}
          <Bar dataKey="Reported" fill={REPORTED_COLOR} />
          <Bar dataKey="Estimate" fill={ESTIMATE_COLOR} />
          <BarXAxis formatLabel={formatFiscalPeriod} />
          <YAxis formatValue={fmtEps} />
          <ChartTooltip
            rows={(point) =>
              (
                [
                  ["Reported", REPORTED_COLOR],
                  ["Estimate", ESTIMATE_COLOR],
                ] as const
              )
                // A period has one or the other, not both, outside the reported
                // quarters — drop the empty half rather than showing "$0.00".
                .filter(([key]) => point[key] != null)
                .map(([key, color]) => ({
                  color,
                  label: key,
                  value: fmtEps(Number(point[key])),
                }))
            }
            formatTitle={formatFiscalPeriod}
            showDatePill={false}
          />
        </BarChart>
      </div>

      {!hasBoth && (
        <p className="mt-3 text-xs leading-relaxed text-text-tertiary">
          Historical consensus isn&rsquo;t available for past years, so reported
          figures show alone and only the forecast years carry an estimate.
        </p>
      )}
    </div>
  );
}
