"use client";

import { AlertTriangle } from "lucide-react";
import type { BacktestRun } from "@/types/backtest";
import {
  formatDate,
  formatPct,
  formatRatio,
  formatStrategyName,
} from "@/utils/backtestFormat";

interface RunListProps {
  runs: BacktestRun[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function StatusBadge({ status }: { status: BacktestRun["status"] }) {
  if (status === "complete") return null;
  const cls =
    status === "failed"
      ? "border-red-primary/40 text-red-primary"
      : "border-border-primary text-text-tertiary";
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${cls}`}>
      {status}
    </span>
  );
}

export function RunList({ runs, selectedId, onSelect }: RunListProps) {
  return (
    <div className="flex flex-col gap-2">
      {runs.map((run) => {
        const m = run.metrics;
        const selected = run.id === selectedId;
        return (
          <button
            className={`rounded-xl border p-3 text-left transition-colors ${
              selected
                ? "border-oak-300 bg-bg-elevated"
                : "border-border-primary bg-bg-secondary hover:bg-bg-tertiary"
            }`}
            key={run.id}
            onClick={() => onSelect(run.id)}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text-primary">
                {formatStrategyName(run.strategy)}
              </span>
              <StatusBadge status={run.status} />
            </div>

            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="font-financial">{run.ticker}</span>
              {run.market_code && <span>· {run.market_code}</span>}
              {/* USO/UNG roll front-month futures; in contango that bleeds
                  several percent a year against spot. Say so up front. */}
              {run.proxy_quality === "degraded" && (
                <span
                  className="flex items-center gap-0.5 text-amber-500"
                  title="Contango-prone ETF proxy — results partly measure roll decay, not the signal"
                >
                  <AlertTriangle size={11} />
                  proxy
                </span>
              )}
            </div>

            {run.status === "failed" && run.error ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-red-primary">
                {run.error}
              </p>
            ) : (
              <div className="mt-2 flex items-center gap-3 font-financial text-xs">
                <span
                  className={
                    (m?.cagr ?? 0) >= 0 ? "text-green-primary" : "text-red-primary"
                  }
                >
                  {formatPct(m?.cagr, 1, true)}
                </span>
                <span className="text-text-tertiary">
                  SR {formatRatio(m?.sharpe)}
                </span>
                <span className="text-text-tertiary">
                  DD {formatPct(m?.max_drawdown, 0)}
                </span>
                <span className="text-text-tertiary">
                  {m?.trade_count ?? 0} trades
                </span>
              </div>
            )}

            <p className="mt-1.5 text-[11px] text-text-tertiary">
              {formatDate(run.start_date)} → {formatDate(run.end_date)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
