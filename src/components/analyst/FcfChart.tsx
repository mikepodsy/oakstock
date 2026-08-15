"use client";

import { useMemo, useState } from "react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { YAxis } from "@/components/charts/y-axis";
import { ZeroLine } from "@/components/charts/zero-line";
import { formatCompactNumber, formatFiscalPeriod } from "@/utils/formatters";
import type { CashFlowPeriod } from "@/types";

interface FcfChartProps {
  annual: CashFlowPeriod[];
  quarterly: CashFlowPeriod[];
  /** Reporting currency, e.g. "USD". Shown next to the title when known. */
  currency?: string | null;
}

const POSITIVE_COLOR = "var(--green-primary)";
const NEGATIVE_COLOR = "var(--red-primary)";
const SUPPORT_COLOR = "var(--text-tertiary)";

type Mode = "annual" | "quarterly";

function fmtMoney(v: number): string {
  return `${v < 0 ? "−" : ""}$${formatCompactNumber(Math.abs(v))}`;
}

/**
 * Free cash flow per period, alongside the EPS chart.
 *
 * Bars are coloured by sign rather than by series: cash burn is the thing a
 * reader needs to spot at a glance, and a single-series chart has no legend to
 * carry that meaning otherwise.
 */
export function FcfChart({ annual, quarterly, currency }: FcfChartProps) {
  const [mode, setMode] = useState<Mode>(
    annual.length > 0 ? "annual" : "quarterly"
  );

  const periods = mode === "annual" ? annual : quarterly;

  const rows = useMemo(
    () =>
      periods.map((p) => ({
        label: p.label,
        fcf: p.freeCashFlow,
        operatingCashFlow: p.operatingCashFlow,
        capex: p.capex,
      })),
    [periods]
  );

  if (annual.length === 0 && quarterly.length === 0) return null;

  const hasNegative = periods.some((p) => p.freeCashFlow < 0);

  return (
    <div className="min-w-0 rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-text-primary">
          Free cash flow{" "}
          {currency && <span className="text-text-tertiary">· {currency}</span>}
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

      {/* Scrolls on its own when the bands get tight, so the page never does. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <BarChart
          // A single series with a handful of annual periods would otherwise
          // fill each band edge to edge and read as a block, not a bar.
          barGap={0.45}
          className="h-[200px] min-w-[420px]"
          data={rows}
          margin={{ top: 12, right: 8, bottom: 28, left: 52 }}
          xDataKey="label"
        >
          <Grid horizontal />
          <Bar
            dataKey="fcf"
            fill={POSITIVE_COLOR}
            negativeFill={NEGATIVE_COLOR}
          />
          {/* Only meaningful once a bar actually crosses it. */}
          {hasNegative && <ZeroLine />}
          <BarXAxis formatLabel={formatFiscalPeriod} />
          <YAxis formatValue={fmtMoney} />
          <ChartTooltip
            rows={(point) => {
              const fcf = Number(point.fcf);
              const out = [
                {
                  color: fcf < 0 ? NEGATIVE_COLOR : POSITIVE_COLOR,
                  label: `FCF · ${formatFiscalPeriod(String(point.label))}`,
                  value: fmtMoney(fcf),
                },
              ];
              // The two inputs, when the filing carries them — FCF on its own
              // doesn't say whether a drop came from operations or spending.
              if (point.operatingCashFlow != null) {
                out.push({
                  color: SUPPORT_COLOR,
                  label: "Operating CF",
                  value: fmtMoney(Number(point.operatingCashFlow)),
                });
              }
              if (point.capex != null) {
                out.push({
                  color: SUPPORT_COLOR,
                  label: "Capex",
                  value: fmtMoney(Number(point.capex)),
                });
              }
              return out;
            }}
            showDatePill={false}
          />
        </BarChart>
      </div>
    </div>
  );
}
