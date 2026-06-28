"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MomentumTable } from "@/components/alerts/MomentumTable";
import { CompactMomentumTable } from "@/components/alerts/CompactMomentumTable";
import { MaCrossingsList } from "@/components/alerts/MaCrossingsList";
import { useMomentumAlerts } from "@/hooks/useMomentumAlerts";
import { useSp400Momentum } from "@/hooks/useSp400Momentum";
import type { StoredMomentum } from "@/app/api/alerts/sp400/route";

function fmtUpdated(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AlertsPage() {
  const mag7 = useMomentumAlerts();
  const sp = useSp400Momentum();

  // Combined universe for the recent-crossings list (large caps already exclude
  // the Mag 7, but dedupe defensively; the precomputed sp row wins).
  const combined = useMemo<StoredMomentum[]>(() => {
    const map = new Map<string, StoredMomentum>();
    for (const s of sp.statuses) map.set(s.ticker, s);
    for (const s of mag7.statuses) {
      if (!map.has(s.ticker)) map.set(s.ticker, { ...s, name: null, marketCap: null });
    }
    return [...map.values()];
  }, [sp.statuses, mag7.statuses]);

  const crossingsLoading =
    mag7.loading && sp.loading && combined.length === 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">Alerts</h1>
        <p className="text-sm text-text-secondary mt-1">
          Momentum vs the 50-day and 200-day moving averages (daily). Fresh
          same-session crosses are ringed; rows with any fresh cross are highlighted.
        </p>
      </div>

      {/* Two columns: Mag 7 (live) on the left, large-cap universe (precomputed) on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] gap-6 items-start">
        {/* Left: Mag 7 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-wide text-text-secondary">
              Magnificent 7
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={mag7.refetch}
              disabled={mag7.loading}
              title="Refresh Mag 7"
              className="text-text-tertiary hover:text-text-primary"
            >
              <RefreshCw className={`h-4 w-4 ${mag7.loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {mag7.error && (
            <div className="mb-3 rounded-lg border border-red-primary bg-red-muted px-3 py-2 text-sm text-red-primary">
              {mag7.error}
            </div>
          )}
          {mag7.loading && mag7.statuses.length === 0 ? (
            <div className="text-sm text-text-secondary">Loading momentum…</div>
          ) : (
            <MomentumTable statuses={mag7.statuses} />
          )}

          {/* Recent MA crossings across the Mag 7 + large-cap universe */}
          <div className="mt-8">
            <div className="mb-2">
              <h2 className="font-display text-sm uppercase tracking-wide text-text-secondary">
                Recent MA crossings
              </h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                Stocks that rose above or fell below their 50d / 200d MA in the last 5 trading days.
              </p>
            </div>
            {crossingsLoading ? (
              <div className="text-sm text-text-secondary">Loading crossings…</div>
            ) : (
              <MaCrossingsList statuses={combined} />
            )}
          </div>
        </section>

        {/* Right: large-cap universe */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-display text-sm uppercase tracking-wide text-text-secondary">
              S&P 500 Large Caps{" "}
              {sp.statuses.length > 0 && (
                <span className="text-text-tertiary">({sp.statuses.length})</span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-tertiary">
                Updated {fmtUpdated(sp.lastUpdated)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={sp.triggerRefresh}
                disabled={sp.refreshing}
                title="Recompute all large caps (takes ~30s)"
                className="text-text-tertiary hover:text-text-primary"
              >
                <RefreshCw className={`h-4 w-4 ${sp.refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          {sp.error && (
            <div className="mb-3 rounded-lg border border-red-primary bg-red-muted px-3 py-2 text-sm text-red-primary">
              {sp.error}
            </div>
          )}
          {sp.loading && sp.statuses.length === 0 ? (
            <div className="text-sm text-text-secondary">Loading momentum…</div>
          ) : sp.statuses.length === 0 ? (
            <div className="rounded-xl border border-border-primary bg-bg-secondary px-4 py-6 text-sm text-text-secondary">
              No data yet. Click refresh to compute the large-cap universe (~30s).
            </div>
          ) : (
            <CompactMomentumTable statuses={sp.statuses} />
          )}
        </section>
      </div>
    </div>
  );
}
