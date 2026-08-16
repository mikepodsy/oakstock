"use client";

import type { BacktestTrade, ExitReason } from "@/types/backtest";
import { formatDate, formatMoney, formatPct } from "@/utils/backtestFormat";

interface TradeLogTableProps {
  trades: BacktestTrade[];
}

const EXIT_LABEL: Record<ExitReason, string> = {
  signal: "Signal",
  stop: "Stopped",
  end_of_data: "Still open",
};

const EXIT_CLASS: Record<ExitReason, string> = {
  signal: "text-text-secondary",
  stop: "text-red-primary",
  end_of_data: "text-text-tertiary",
};

export function TradeLogTable({ trades }: TradeLogTableProps) {
  if (trades.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-tertiary">
        This run never opened a position.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary text-left text-xs text-text-secondary">
            <th className="px-3 py-2 font-normal">Entry</th>
            <th className="px-3 py-2 font-normal">Exit</th>
            <th className="px-3 py-2 font-normal">Side</th>
            <th className="px-3 py-2 text-right font-normal">Entry px</th>
            <th className="px-3 py-2 text-right font-normal">Exit px</th>
            <th className="px-3 py-2 text-right font-normal">Return</th>
            <th className="px-3 py-2 text-right font-normal">Bars</th>
            <th className="px-3 py-2 font-normal">Closed by</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const reason = (t.exit_reason ?? "signal") as ExitReason;
            const positive = (t.return_pct ?? 0) > 0;
            return (
              <tr
                className="border-b border-border-secondary last:border-0"
                key={t.id}
              >
                <td className="px-3 py-2 font-financial text-text-primary">
                  {formatDate(t.entry_date)}
                </td>
                <td className="px-3 py-2 font-financial text-text-secondary">
                  {formatDate(t.exit_date)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      t.direction === "long"
                        ? "text-green-primary"
                        : "text-red-primary"
                    }
                  >
                    {t.direction === "long" ? "Long" : "Short"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-financial text-text-secondary">
                  {formatMoney(t.entry_price)}
                </td>
                <td className="px-3 py-2 text-right font-financial text-text-secondary">
                  {formatMoney(t.exit_price)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-financial ${
                    positive ? "text-green-primary" : "text-red-primary"
                  }`}
                >
                  {formatPct(t.return_pct, 2, true)}
                </td>
                <td className="px-3 py-2 text-right font-financial text-text-secondary">
                  {t.bars_held ?? "—"}
                </td>
                <td className={`px-3 py-2 text-xs ${EXIT_CLASS[reason]}`}>
                  {EXIT_LABEL[reason]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
