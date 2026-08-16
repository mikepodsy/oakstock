"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { BacktestLoadingSkeleton } from "@/components/backtesting/BacktestLoadingSkeleton";
import { DrawdownChart } from "@/components/backtesting/DrawdownChart";
import { EquityCurveChart } from "@/components/backtesting/EquityCurveChart";
import { MetricsGrid } from "@/components/backtesting/MetricsGrid";
import { RunList } from "@/components/backtesting/RunList";
import { TradeLogTable } from "@/components/backtesting/TradeLogTable";
import { useBacktestRun } from "@/hooks/useBacktestRun";
import { useBacktestRuns } from "@/hooks/useBacktestRuns";
import {
  formatDate,
  formatParams,
  formatStrategyName,
} from "@/utils/backtestFormat";

const CARD = "rounded-xl border border-border-primary bg-bg-secondary p-4";

export default function BacktestingPage() {
  const { data: runs, loading, error, refetch } = useBacktestRuns();
  const [chosenId, setChosenId] = useState<string | null>(null);

  // Derived rather than synced through an effect: until the user picks a run,
  // show the newest one. Setting state from an effect here would cause a
  // cascading render for no benefit.
  const selectedId = chosenId ?? runs?.[0]?.id ?? null;

  const {
    data: detail,
    loading: detailLoading,
    error: detailError,
  } = useBacktestRun(selectedId);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="font-display text-2xl text-text-primary">Backtesting</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Saved strategy runs over point-in-time COT positioning and daily prices.
      </p>

      {loading && (
        <div className="mt-6">
          <BacktestLoadingSkeleton />
        </div>
      )}

      {!loading && error && (
        <div className={`mt-6 ${CARD}`}>
          <p className="text-sm text-text-primary">{error}</p>
          <button
            className="mt-3 rounded-lg border border-border-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary"
            onClick={refetch}
            type="button"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && runs && runs.length === 0 && (
        <div className={`mt-6 ${CARD}`}>
          <p className="text-sm text-text-primary">No saved runs yet.</p>
          <p className="mt-2 text-sm text-text-secondary">
            Create one from the engine in{" "}
            <code className="font-financial text-text-primary">tools/backtest</code>:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-xs text-text-secondary">
{`python -m oakbt.cli backfill --years 4
python -m oakbt.cli run --strategy cot_index_reversal --market SP500`}
          </pre>
        </div>
      )}

      {!loading && !error && runs && runs.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
          <RunList
            onSelect={setChosenId}
            runs={runs}
            selectedId={selectedId}
          />

          <div className="flex min-w-0 flex-col gap-4">
            {detailLoading && <BacktestLoadingSkeleton />}

            {!detailLoading && detailError && (
              <div className={CARD}>
                <p className="text-sm text-text-primary">{detailError}</p>
              </div>
            )}

            {!detailLoading && !detailError && detail && (
              <>
                <div className={CARD}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-lg text-text-primary">
                      {formatStrategyName(detail.run.strategy)} · {detail.run.ticker}
                    </h2>
                    <span className="text-xs text-text-tertiary">
                      {formatDate(detail.run.start_date)} →{" "}
                      {formatDate(detail.run.end_date)}
                      {detail.run.code_version && ` · ${detail.run.code_version}`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {formatParams(detail.run.params)}
                  </p>

                  {detail.run.proxy_quality === "degraded" && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-500">
                      <AlertTriangle className="mt-px shrink-0" size={13} />
                      <span>
                        {detail.run.ticker} rolls front-month futures monthly. In
                        contango that costs several percent a year, so these
                        results partly measure roll decay rather than the signal.
                      </span>
                    </p>
                  )}

                  {(detail.run.metrics?.trade_count ?? 0) < 20 && (
                    <p className="mt-2 text-xs text-text-tertiary">
                      Only {detail.run.metrics?.trade_count ?? 0} closed trades —
                      too few to separate skill from luck. Treat as directional.
                    </p>
                  )}
                </div>

                {detail.run.status === "failed" && detail.run.error && (
                  <div className={`${CARD} border-red-primary/40`}>
                    <p className="text-sm text-red-primary">
                      {detail.run.error}
                    </p>
                  </div>
                )}

                {detail.run.metrics && (
                  <MetricsGrid
                    metrics={detail.run.metrics}
                    ticker={detail.run.ticker}
                  />
                )}

                <div className={CARD}>
                  <h3 className="mb-2 text-sm text-text-secondary">
                    Equity vs buy &amp; hold (both rebased to 100)
                  </h3>
                  <EquityCurveChart
                    equity={detail.equity}
                    ticker={detail.run.ticker}
                  />
                </div>

                <div className={CARD}>
                  <h3 className="mb-2 text-sm text-text-secondary">Drawdown</h3>
                  <DrawdownChart equity={detail.equity} />
                </div>

                <div className={CARD}>
                  <h3 className="mb-2 text-sm text-text-secondary">
                    Trades ({detail.trades.length})
                  </h3>
                  <TradeLogTable trades={detail.trades} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
