"use client";

import type { DcfResult } from "@/types";
import { formatCurrency, formatPercent, formatCompactNumber } from "@/utils/formatters";

interface DcfResultCardProps {
  result: DcfResult;
  currentPrice: number;
}

export function DcfResultCard({ result, currentPrice }: DcfResultCardProps) {
  const upside =
    currentPrice > 0
      ? ((result.intrinsicValuePerShare - currentPrice) / currentPrice) * 100
      : 0;
  const isUndervalued = upside > 0;

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 mb-6">
      <h2 className="text-lg font-medium text-text-primary mb-4">
        Valuation Result
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <p className="text-xs text-text-tertiary mb-1">Current Price</p>
          <p className="text-2xl font-financial text-text-primary">
            {formatCurrency(currentPrice)}
          </p>
        </div>

        <div>
          <p className="text-xs text-text-tertiary mb-1">Intrinsic Value</p>
          <p className="text-2xl font-financial text-text-primary">
            {formatCurrency(result.intrinsicValuePerShare)}
          </p>
        </div>

        <div>
          <p className="text-xs text-text-tertiary mb-1">Upside / Downside</p>
          <p
            className={`text-2xl font-financial ${
              isUndervalued ? "text-green-primary" : "text-red-primary"
            }`}
          >
            {formatPercent(upside)}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {isUndervalued ? "Potentially undervalued" : "Potentially overvalued"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-border-primary">
        <div>
          <p className="text-xs text-text-tertiary mb-1">Enterprise Value</p>
          <p className="text-sm font-financial text-text-primary">
            ${formatCompactNumber(result.enterpriseValue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">Equity Value</p>
          <p className="text-sm font-financial text-text-primary">
            ${formatCompactNumber(result.equityValue)}
          </p>
        </div>
      </div>
    </div>
  );
}
