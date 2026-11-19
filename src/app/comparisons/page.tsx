"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Scale } from "lucide-react";
import { TickerSearch } from "@/components/search/TickerSearch";
import { Skeleton } from "@/components/ui/skeleton";
import { PeerBar } from "@/components/comparisons/PeerBar";
import { MetricPicker } from "@/components/comparisons/MetricPicker";
import { CompsTable } from "@/components/comparisons/CompsTable";
import { RankedBarChart } from "@/components/comparisons/RankedBarChart";
import { ScatterRegression } from "@/components/comparisons/ScatterRegression";
import { HistoryChart } from "@/components/comparisons/HistoryChart";
import { useCompHistory, useCompRows, usePeers } from "@/hooks/useComps";
import { DEFAULT_PRESET, PRESETS, isMetricId, type MetricId } from "@/lib/comps/registry";

const MAX_PEERS = 15;

function parseList(raw: string | null, upper = true): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((t) => (upper ? t.trim().toUpperCase() : t.trim()))
        .filter(Boolean)
    ),
  ];
}

function parseMetric(raw: string | null, fallback: MetricId): MetricId {
  return raw && isMetricId(raw) ? raw : fallback;
}

function ComparisonsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const target = params.get("t")?.toUpperCase() || null;
  // `peers` absent = use the suggested set; present (even empty) = user's set.
  const peersParam = params.get("peers");
  const metricsParam = parseList(params.get("m"), false).filter(isMetricId) as MetricId[];
  const metrics = metricsParam.length ? metricsParam : PRESETS[DEFAULT_PRESET];
  const heatmap = params.get("heat") !== "0";
  const barMetric = parseMetric(params.get("bar"), "evEbitda");
  const xMetric = parseMetric(params.get("x"), "revenueGrowth");
  const yMetric = parseMetric(params.get("y"), "evEbitda");

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v == null) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  const [refreshKey, setRefreshKey] = useState(0);
  const suggestion = usePeers(target, refreshKey);
  const suggestedTickers = useMemo(
    () => (suggestion.data?.peers ?? []).map((p) => p.ticker),
    [suggestion.data]
  );

  const peers = useMemo(
    () => (peersParam != null ? parseList(peersParam) : suggestedTickers).filter((p) => p !== target),
    [peersParam, suggestedTickers, target]
  );

  // A fresh suggestion (Re-suggest) replaces the user's set.
  useEffect(() => {
    if (refreshKey && suggestion.data) update({ peers: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when a re-suggest lands
  }, [suggestion.data]);

  const tickers = useMemo(() => (target ? [target, ...peers] : []), [target, peers]);
  const waitingForPeers = peersParam == null && suggestion.loading;
  const comps = useCompRows(waitingForPeers ? [] : tickers);
  const history = useCompHistory(waitingForPeers ? null : target, peers);
  const rows = comps.data?.rows ?? [];

  const setPeers = (list: string[]) => update({ peers: list.slice(0, MAX_PEERS).join(",") });

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl text-text-primary">
            <Scale className="size-5 text-oak-300" /> Comparisons
          </h1>
          <p className="text-sm text-text-secondary">
            Relative valuation: how a company stacks up against its peers on multiples, growth and quality.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <TickerSearch
            onSelect={(r) => {
              setRefreshKey(0); // a new target uses the cache, not a forced re-suggest
              update({ t: r.ticker.toUpperCase(), peers: null });
            }}
          />
        </div>
      </div>

      {!target ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-primary bg-bg-secondary py-20 text-center">
          <Scale className="mb-3 size-8 text-text-tertiary" />
          <p className="text-text-primary">Search for a ticker to build its comp set</p>
          <p className="mt-1 text-sm text-text-secondary">
            Peers are suggested automatically, and you can add or remove any of them.
          </p>
        </div>
      ) : (
        <>
          <PeerBar
            target={target}
            peers={peers}
            suggested={suggestion.data?.peers ?? null}
            approximate={suggestion.data?.approximate ?? false}
            loadingSuggestions={suggestion.loading}
            onAdd={(t) => {
              const up = t.toUpperCase();
              if (up !== target && !peers.includes(up)) setPeers([...peers, up]);
            }}
            onRemove={(t) => setPeers(peers.filter((p) => p !== t))}
            onReset={() => update({ peers: null })}
            onRegenerate={() => setRefreshKey((k) => k + 1)}
          />
          {suggestion.error && (
            <p className="text-xs text-red-primary">Couldn&apos;t suggest peers: {suggestion.error}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <MetricPicker selected={metrics} onChange={(ids) => update({ m: ids.join(",") })} />
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={heatmap}
                onChange={(e) => update({ heat: e.target.checked ? null : "0" })}
                className="accent-green-primary"
              />
              Percentile heatmap
            </label>
          </div>

          {comps.error && <p className="text-sm text-red-primary">{comps.error}</p>}
          {(comps.loading || waitingForPeers) && rows.length === 0 ? (
            <Skeleton className="h-[360px] w-full rounded-xl" />
          ) : (
            <div className={comps.loading ? "opacity-60 transition-opacity" : undefined}>
              <CompsTable
                rows={rows}
                target={target}
                metrics={metrics}
                heatmap={heatmap}
                activeMetric={barMetric}
                onActiveMetric={(id) => update({ bar: id })}
                onRemove={(t) => setPeers(peers.filter((p) => p !== t))}
              />
            </div>
          )}
          <p className="text-[11px] text-text-tertiary">
            NM = not meaningful (negative or missing denominator), left out of the medians. TTM figures from
            reported quarters; market cap and EV in USD. Click a column header to sort it and chart it.
          </p>

          {rows.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <RankedBarChart rows={rows} target={target} metric={barMetric} onMetric={(id) => update({ bar: id })} />
              <ScatterRegression
                rows={rows}
                target={target}
                x={xMetric}
                y={yMetric}
                onX={(id) => update({ x: id })}
                onY={(id) => update({ y: id })}
              />
            </div>
          )}

          <HistoryChart
            target={target}
            points={history.data?.points ?? null}
            loading={history.loading || waitingForPeers}
            error={history.error}
          />
        </>
      )}
    </div>
  );
}

export default function ComparisonsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-[400px] rounded-xl" />}>
      <ComparisonsView />
    </Suspense>
  );
}
