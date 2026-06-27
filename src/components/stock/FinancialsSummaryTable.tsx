"use client";

import { formatCompactNumber } from "@/utils/formatters";
import type { FinancialStatement, FundamentalsData } from "@/types";

interface FinancialsSummaryTableProps {
  data: FundamentalsData;
}

const usd = (v: number | null) =>
  v == null ? "—" : `$${formatCompactNumber(Math.abs(v))}`;
const per = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const num = (v: number | null) => (v == null ? "—" : v.toFixed(2));

function marginPct(part: number | null, whole: number | null): number | null {
  if (part == null || whole == null || whole === 0) return null;
  return +((part / whole) * 100).toFixed(1);
}

function debtToEquity(s: FinancialStatement): number | null {
  if (s.totalDebt == null || s.stockholdersEquity == null || s.stockholdersEquity === 0)
    return null;
  return +(s.totalDebt / s.stockholdersEquity).toFixed(2);
}

// Most recent annual figures. Shows the latest fiscal year and, when present,
// the prior year alongside it for quick context.
export function FinancialsSummaryTable({ data }: FinancialsSummaryTableProps) {
  const years = data.annual.slice(-2).reverse(); // newest first
  if (years.length === 0) return null;

  const rows: { label: string; fmt: (s: FinancialStatement) => string }[] = [
    { label: "Revenue", fmt: (s) => usd(s.revenue) },
    { label: "Gross Profit", fmt: (s) => usd(s.grossProfit) },
    { label: "Gross Margin", fmt: (s) => per(marginPct(s.grossProfit, s.revenue)) },
    { label: "Operating Income", fmt: (s) => usd(s.operatingIncome) },
    { label: "EBITDA", fmt: (s) => usd(s.ebitda) },
    { label: "Net Income", fmt: (s) => usd(s.netIncome) },
    { label: "Net Margin", fmt: (s) => per(marginPct(s.netIncome, s.revenue)) },
    { label: "EPS (Diluted)", fmt: (s) => num(s.eps) },
    { label: "EPS (Basic)", fmt: (s) => num(s.epsBasic) },
    { label: "Operating Cash Flow", fmt: (s) => usd(s.operatingCashFlow) },
    { label: "Capital Expenditure", fmt: (s) => usd(s.capex) },
    { label: "Free Cash Flow", fmt: (s) => usd(s.freeCashFlow) },
    { label: "Total Debt", fmt: (s) => usd(s.totalDebt) },
    { label: "Shareholders' Equity", fmt: (s) => usd(s.stockholdersEquity) },
    { label: "Debt / Equity", fmt: (s) => num(debtToEquity(s)) },
    { label: "Buybacks", fmt: (s) => usd(s.buybacks) },
    { label: "Dividends Paid", fmt: (s) => usd(s.dividendsPaid) },
  ];

  return (
    <div className="mb-6">
      <h2 className="text-lg font-display font-semibold text-text-primary mb-4">
        Annual Summary
      </h2>
      <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-secondary">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-left font-medium text-text-tertiary px-4 py-2.5">
                Metric
              </th>
              {years.map((s) => (
                <th
                  key={s.date}
                  className="text-right font-medium text-text-secondary px-4 py-2.5 tabular-nums"
                >
                  FY {new Date(s.date).getFullYear()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={i % 2 === 1 ? "bg-bg-primary/30" : undefined}
              >
                <td className="text-left text-text-secondary px-4 py-2">
                  {row.label}
                </td>
                {years.map((s) => (
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
