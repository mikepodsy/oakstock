"use client";

import type { SensitivityCell } from "@/types";
import { formatCurrency } from "@/utils/formatters";

interface DcfSensitivityTableProps {
  data: SensitivityCell[][];
  currentPrice: number;
}

function getCellClasses(intrinsicValue: number, currentPrice: number): string {
  if (currentPrice <= 0) return "";
  const upside = ((intrinsicValue - currentPrice) / currentPrice) * 100;
  if (upside > 20) return "bg-green-primary/15 text-green-primary";
  if (upside > 0) return "bg-green-primary/5 text-text-primary";
  if (upside > -20) return "bg-red-primary/5 text-text-primary";
  return "bg-red-primary/15 text-red-primary";
}

export function DcfSensitivityTable({ data, currentPrice }: DcfSensitivityTableProps) {
  if (!data.length || !data[0].length) return null;

  const discountRates = data[0].map((c) => c.discountRate);

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-6">
      <h2 className="text-lg font-medium text-text-primary mb-1">
        Sensitivity Analysis
      </h2>
      <p className="text-xs text-text-secondary mb-4">
        Intrinsic value per share — Phase 1 growth rate vs. discount rate (WACC)
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="border border-border-primary bg-bg-tertiary p-2 text-text-tertiary font-medium text-left">
                Growth \ WACC
              </th>
              {discountRates.map((dr) => (
                <th
                  key={dr}
                  className="border border-border-primary bg-bg-tertiary p-2 text-text-tertiary font-medium text-center"
                >
                  {(dr * 100).toFixed(1)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td className="border border-border-primary bg-bg-tertiary p-2 text-text-tertiary font-medium">
                  {(row[0].growthRate * 100).toFixed(1)}%
                </td>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`border border-border-primary p-2 text-center font-financial ${getCellClasses(
                      cell.intrinsicValue,
                      currentPrice
                    )}`}
                  >
                    {formatCurrency(cell.intrinsicValue)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 mt-4 text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-primary/15 border border-green-primary/30" />
          <span>Undervalued (&gt;20%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-primary/15 border border-red-primary/30" />
          <span>Overvalued (&lt;-20%)</span>
        </div>
      </div>
    </div>
  );
}
