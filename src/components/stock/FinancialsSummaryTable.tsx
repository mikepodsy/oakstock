"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  SUMMARY_ROWS,
  annualLabel,
  latestPeriods,
  quarterlyLabel,
} from "@/utils/financialSummary";
import type { FinancialStatement, FundamentalsData } from "@/types";

interface FinancialsSummaryTableProps {
  data: FundamentalsData;
}

const ANNUAL_PERIODS = 4;
const QUARTERLY_PERIODS = 4;

function SummaryTable({
  periods,
  labelFor,
}: {
  periods: FinancialStatement[];
  labelFor: (s: FinancialStatement) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-secondary">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary">
            <th className="text-left font-medium text-text-tertiary px-4 py-2.5">
              Metric
            </th>
            {periods.map((s) => (
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
              {periods.map((s) => (
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
  );
}

// The last four fiscal years, with the heading opening the same breakdown for
// the last four reported quarters.
export function FinancialsSummaryTable({ data }: FinancialsSummaryTableProps) {
  const [open, setOpen] = useState(false);

  const years = latestPeriods(data.annual, ANNUAL_PERIODS);
  const quarters = latestPeriods(data.quarterly, QUARTERLY_PERIODS);

  if (years.length === 0) return null;

  const heading = "Annual Summary";

  return (
    <div className="mb-6">
      {quarters.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="group mb-4 flex cursor-pointer items-center gap-1.5 text-lg font-display font-semibold text-text-primary transition-colors hover:text-green-primary"
        >
          {heading}
          <ChevronRight
            size={18}
            className="text-text-tertiary transition-colors group-hover:text-green-primary"
          />
          <span className="text-xs font-sans font-normal text-text-tertiary transition-colors group-hover:text-green-primary">
            View quarterly
          </span>
        </button>
      ) : (
        <h2 className="text-lg font-display font-semibold text-text-primary mb-4">
          {heading}
        </h2>
      )}

      <SummaryTable periods={years} labelFor={annualLabel} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-border-primary bg-bg-secondary sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-text-primary font-display">
              Quarterly Summary
            </DialogTitle>
            <DialogDescription className="text-text-secondary">
              The last {quarters.length === 1 ? "reported quarter" : `${quarters.length} reported quarters`} for {data.ticker}.
            </DialogDescription>
          </DialogHeader>
          <SummaryTable periods={quarters} labelFor={quarterlyLabel} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
