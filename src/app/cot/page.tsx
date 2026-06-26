"use client";

import { useState } from "react";
import { useCotData } from "@/hooks/useCotData";
import { CotInstrumentTabs } from "@/components/cot/CotInstrumentTabs";
import { CotPositionChart } from "@/components/cot/CotPositionChart";
import { CotNetChart } from "@/components/cot/CotNetChart";
import { CotHistoryChart } from "@/components/cot/CotHistoryChart";
import { CotLoadingSkeleton } from "@/components/cot/CotLoadingSkeleton";
import { formatDate } from "@/utils/formatters";
import { RefreshCw } from "lucide-react";

type CotView = "detailed" | "legacy";

export default function CotPage() {
  const { data, loading, error, refetch } = useCotData();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<CotView>("detailed");

  const report = data?.length
    ? (data.find((r) => r.instrument === selected) ?? data[0])
    : null;

  // Pick the active category set: legacy (Commercial / Non-Commercial /
  // Non-Reportable) when toggled on and available, otherwise the detailed report.
  const hasLegacy = !!report?.legacy;
  const activeView: CotView = view === "legacy" && hasLegacy ? "legacy" : "detailed";
  const groups =
    activeView === "legacy" && report?.legacy
      ? report.legacy
      : report
        ? { categories: report.categories, history: report.history }
        : null;
  const viewLabel = activeView === "legacy" ? "Legacy" : "Detailed";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-text-primary">COT Report</h1>
          <p className="text-sm text-text-secondary mt-1">
            CFTC Commitment of Traders — positioning by trader category
          </p>
        </div>
        {report && (
          <div className="text-right">
            <span className="text-xs text-text-tertiary">Report date</span>
            <p className="text-sm font-mono text-text-secondary">{formatDate(report.reportDate)}</p>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && <CotLoadingSkeleton />}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 text-center">
          <p className="text-sm text-text-secondary mb-3">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="flex items-center gap-2 mx-auto px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-primary text-sm hover:bg-bg-elevated transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && report && groups && (
        <div className="space-y-4">
          {/* Instrument tabs */}
          <CotInstrumentTabs
            reports={data}
            selected={report.instrument}
            onSelect={setSelected}
          />

          {/* Detailed / Legacy view toggle (legacy adds the Commercial group). */}
          {hasLegacy && (
            <div className="flex gap-2">
              {(["detailed", "legacy"] as CotView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={activeView === v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeView === v
                      ? "bg-green-muted text-green-primary"
                      : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                  }`}
                >
                  {v === "legacy" ? "Legacy (Commercial)" : "Detailed"}
                </button>
              ))}
            </div>
          )}

          {/* Long / Short chart */}
          <CotPositionChart
            categories={groups.categories}
            title={`${report.instrument} — Long / Short Positioning (${viewLabel})`}
          />

          {/* Net position chart */}
          <CotNetChart categories={groups.categories} />

          {/* Historical positioning (selectable look-back window) */}
          <CotHistoryChart
            history={groups.history}
            categoryNames={groups.categories.map((c) => c.name)}
            title={`${report.instrument} — Positioning Over Time (${viewLabel})`}
          />
        </div>
      )}

      {/* Empty state (API returned 0 instruments) */}
      {!loading && !error && data && data.length === 0 && (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 text-center">
          <p className="text-sm text-text-secondary mb-3">
            No COT data available. CFTC data may be temporarily unavailable.
          </p>
          <button
            type="button"
            onClick={refetch}
            className="flex items-center gap-2 mx-auto px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-primary text-sm hover:bg-bg-elevated transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
