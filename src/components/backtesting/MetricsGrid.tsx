"use client";

import type { BacktestMetrics } from "@/types/backtest";
import {
  formatInt,
  formatPct,
  formatRatio,
  metricTone,
} from "@/utils/backtestFormat";

interface MetricsGridProps {
  metrics: BacktestMetrics;
  ticker: string;
}

const TONE_CLASS = {
  positive: "text-green-primary",
  negative: "text-red-primary",
  neutral: "text-text-primary",
} as const;

function Metric({
  label,
  value,
  benchmark,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  benchmark?: string;
  tone?: keyof typeof TONE_CLASS;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <p className="text-xs text-text-secondary" title={hint}>
        {label}
      </p>
      <p className={`mt-1 font-financial text-lg ${TONE_CLASS[tone]}`}>{value}</p>
      {benchmark !== undefined && (
        <p className="mt-0.5 text-xs text-text-tertiary">vs {benchmark}</p>
      )}
    </div>
  );
}

export function MetricsGrid({ metrics, ticker }: MetricsGridProps) {
  const bench = metrics.benchmark;
  const benchLabel = (v: string) => `${v} · ${ticker}`;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Metric
        benchmark={bench ? benchLabel(formatPct(bench.cagr, 2, true)) : undefined}
        label="CAGR"
        tone={metricTone(metrics.cagr)}
        value={formatPct(metrics.cagr, 2, true)}
      />
      <Metric
        benchmark={bench ? benchLabel(formatRatio(bench.sharpe)) : undefined}
        hint="Annualised excess return per unit of volatility"
        label="Sharpe"
        tone={metricTone(metrics.sharpe)}
        value={formatRatio(metrics.sharpe)}
      />
      <Metric
        benchmark={
          bench ? benchLabel(formatPct(bench.max_drawdown)) : undefined
        }
        hint="Worst peak-to-trough decline"
        label="Max drawdown"
        tone={metricTone(metrics.max_drawdown, false)}
        value={formatPct(metrics.max_drawdown)}
      />
      <Metric
        benchmark={bench ? benchLabel(formatPct(bench.volatility)) : undefined}
        label="Volatility"
        value={formatPct(metrics.volatility)}
      />

      <Metric
        hint="Downside-only Sharpe — upside swings are not penalised"
        label="Sortino"
        tone={metricTone(metrics.sortino)}
        value={formatRatio(metrics.sortino)}
      />
      <Metric
        hint="CAGR divided by max drawdown"
        label="Calmar"
        tone={metricTone(metrics.calmar)}
        value={formatRatio(metrics.calmar)}
      />
      <Metric
        hint="Share of closed trades that made money"
        label="Hit rate"
        value={formatPct(metrics.hit_rate, 1)}
      />
      <Metric
        hint="Closed round trips. A handful of trades cannot separate skill from luck."
        label="Trades"
        value={formatInt(metrics.trade_count)}
      />

      <Metric
        label="Total return"
        tone={metricTone(metrics.total_return)}
        value={formatPct(metrics.total_return, 1, true)}
      />
      <Metric
        hint="Gross profit divided by gross loss"
        label="Profit factor"
        value={formatRatio(metrics.profit_factor)}
      />
      <Metric
        hint="Share of bars holding a non-zero position"
        label="Time in market"
        value={formatPct(metrics.time_in_market, 1)}
      />
      <Metric
        hint="Sum of absolute position changes"
        label="Turnover"
        value={formatRatio(metrics.turnover, 1)}
      />
    </div>
  );
}
