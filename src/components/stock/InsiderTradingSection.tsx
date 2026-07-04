"use client";

import { formatCompactNumber } from "@/utils/formatters";
import { useInsiderTrades } from "@/hooks/useInsiderTrades";
import type { InsiderAction } from "@/lib/finviz/insiderTrading";
import { Skeleton } from "@/components/ui/skeleton";

interface InsiderTradingSectionProps {
  ticker: string;
}

// Buys green, proposed sales yellow, sales red, everything else neutral.
const ACTION_STYLES: Record<InsiderAction, string> = {
  buy: "bg-green-muted text-green-primary",
  proposed_sale: "bg-yellow-500/10 text-yellow-500",
  sale: "bg-red-muted text-red-primary",
  other: "bg-bg-tertiary text-text-tertiary",
};

export function InsiderTradingSection({ ticker }: InsiderTradingSectionProps) {
  const { trades, loading, error } = useInsiderTrades(ticker);

  if (loading) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-display font-semibold text-text-primary mb-4">
          Insider Trading
        </h2>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Best-effort data: not every stock has insider filings, and Finviz may be
  // unreachable. Fail soft by rendering nothing rather than an error box.
  if (error || trades.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-display font-semibold text-text-primary mb-4">
        Insider Trading
      </h2>
      <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-secondary">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-left font-medium text-text-tertiary px-4 py-2.5">
                Insider
              </th>
              <th className="text-left font-medium text-text-tertiary px-4 py-2.5">
                Relationship
              </th>
              <th className="text-left font-medium text-text-tertiary px-4 py-2.5">
                Date
              </th>
              <th className="text-center font-medium text-text-tertiary px-4 py-2.5">
                Transaction
              </th>
              <th className="text-right font-medium text-text-tertiary px-4 py-2.5">
                Shares
              </th>
              <th className="text-right font-medium text-text-tertiary px-4 py-2.5">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr
                key={`${t.owner}-${t.date}-${i}`}
                className="border-b border-border-secondary last:border-0 hover:bg-bg-tertiary transition-colors"
              >
                <td className="text-left text-text-primary px-4 py-2.5">
                  {t.secFormUrl ? (
                    <a
                      href={t.secFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-green-primary hover:underline"
                    >
                      {t.owner}
                    </a>
                  ) : (
                    t.owner
                  )}
                </td>
                <td className="text-left text-text-secondary px-4 py-2.5">
                  {t.relationship}
                </td>
                <td className="text-left text-text-secondary px-4 py-2.5 whitespace-nowrap">
                  {t.date}
                </td>
                <td className="text-center px-4 py-2.5">
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ACTION_STYLES[t.action]}`}
                  >
                    {t.transaction}
                  </span>
                </td>
                <td className="text-right text-text-primary px-4 py-2.5 tabular-nums">
                  {formatCompactNumber(t.shares)}
                </td>
                <td className="text-right text-text-primary px-4 py-2.5 tabular-nums">
                  ${formatCompactNumber(t.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
