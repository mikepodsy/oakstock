"use client";

import { useState } from "react";
import { PeriodToggle } from "@/components/stock/PeriodToggle";
import {
  SUMMARY_ROWS,
  annualLabel,
  latestPeriods,
  quarterlyLabel,
  resolvePeriod,
} from "@/utils/financialSummary";
import type {
  FinancialStatement,
  FundamentalsData,
  StatementPeriod,
} from "@/types";

interface FinancialsSummaryTableProps {
  data: FundamentalsData;
}

const PERIOD_COUNT = 4;

// The charts below default to quarterly; the summary opens the same way so the
// page reads consistently top to bottom.
const DEFAULT_PERIOD: StatementPeriod = "quarterly";

// The last four reported periods, switchable between quarters and fiscal years.
export function FinancialsSummaryTable({ data }: FinancialsSummaryTableProps) {
  const [requested, setRequested] = useState<StatementPeriod>(DEFAULT_PERIOD);

  // A ticker can have one series and not the other, so the rendered period
  // isn't always the requested one.
  const period = resolvePeriod(data, requested);
  if (!period) return null;

  const isQuarterly = period === "quarterly";
  const statements = isQuarterly ? data.quarterly : data.annual;
  const periods = latestPeriods(statements, PERIOD_COUNT);
  const labelFor = isQuarterly ? quarterlyLabel : annualLabel;

  const emptySeries: StatementPeriod[] = [];
  if (data.quarterly.length === 0) emptySeries.push("quarterly");
  if (data.annual.length === 0) emptySeries.push("annual");

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-semibold text-text-primary">
          {isQuarterly ? "Quarterly Summary" : "Annual Summary"}
        </h2>
        <PeriodToggle
          value={period}
          onChange={setRequested}
          disabled={emptySeries}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-secondary">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-left font-medium text-text-tertiary px-4 py-2.5">
                Metric
              </th>
              {periods.map((s: FinancialStatement) => (
                <th
                  key={s.date}
                  className="text-right font-medium text-text-secondary px-4 py-2.5 tabular-nums"
                >
                  {labelFor(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUMMARY_ROWS.map((row, i) => (
              <tr
                key={row.label}
                className={i % 2 === 1 ? "bg-bg-primary/30" : undefined}
              >
                <td className="text-left text-text-secondary px-4 py-2">
                  {row.label}
                </td>
                {periods.map((s: FinancialStatement) => (
                  <td
                    key={s.date}
                    className="text-right text-text-primary px-4 py-2 tabular-nums"
                  >
                    {row.fmt(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
