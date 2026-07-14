"use client";

import { useState } from "react";
import { useCotData } from "@/hooks/useCotData";
import { CotInstrumentTabs } from "@/components/cot/CotInstrumentTabs";
import { CotPositionChart } from "@/components/cot/CotPositionChart";
import { CotNetChart } from "@/components/cot/CotNetChart";
import { CotIndexGauge } from "@/components/cot/CotIndexGauge";
import { CotHistoryChart } from "@/components/cot/CotHistoryChart";
import { CotParticipantShareCard } from "@/components/cot/CotParticipantShareCard";
import { CotLoadingSkeleton } from "@/components/cot/CotLoadingSkeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/utils/formatters";
import { ChevronDown, RefreshCw } from "lucide-react";

type CotView = "detailed" | "legacy";

export default function CotPage() {
  const { data, loading, error, refetch } = useCotData();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<CotView>("detailed");
  // Which historical week (report date) to display; null = latest.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // History is oldest → newest. Build a newest-first date list for the dropdown and
  // resolve the week to display (falling back to the latest when no/stale selection).
  const weeks = groups?.history ?? [];
  const datesNewestFirst = [...weeks].reverse();
  const selectedWeek =
    (selectedDate ? weeks.find((w) => w.reportDate === selectedDate) : null) ??
    weeks[weeks.length - 1] ??
    null;
  const displayCategories = selectedWeek?.categories ?? groups?.categories ?? [];
  const openInterest = selectedWeek?.openInterest ?? report?.openInterest ?? 0;
  const openInterestIndex = selectedWeek?.openInterestIndex ?? report?.openInterestIndex ?? null;
  const isLatest = !selectedWeek || selectedWeek.reportDate === report?.reportDate;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-text-primary">COT Report</h1>
          <p className="text-sm text-text-secondary mt-1">
            CFTC Commitment of Traders — positioning by trader category
          </p>
        </div>
        {report && selectedWeek && (
          <div className="text-right">
            <span className="block text-xs text-text-tertiary mb-1">Report date</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-tertiary text-sm font-mono text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer">
                {formatDate(selectedWeek.reportDate)}
                {!isLatest && <span className="text-xs text-text-tertiary">(past)</span>}
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                <DropdownMenuRadioGroup
                  value={selectedWeek.reportDate}
                  onValueChange={(v) => setSelectedDate(v)}
                >
                  {datesNewestFirst.map((w, i) => (
                    <DropdownMenuRadioItem key={w.reportDate} value={w.reportDate}>
                      {formatDate(w.reportDate)}
                      {i === 0 && <span className="ml-1.5 text-xs text-text-tertiary">latest</span>}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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

          {/* Top row: Long/Short + Net charts, with the participant % of open
              interest breakdown card beside them (stacks below on mobile). */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Long / Short chart (for the selected report week) */}
              <CotPositionChart
                categories={displayCategories}
                title={`${report.instrument} — Long / Short Positioning (${viewLabel})`}
              />

              {/* Net position chart */}
              <CotNetChart categories={displayCategories} />
            </div>

            {/* Each category's longs/shorts as a share of open interest */}
            <CotParticipantShareCard
              categories={displayCategories}
              openInterest={openInterest}
              openInterestIndex={openInterestIndex}
              title={`% of Open Interest (${viewLabel})`}
            />
          </div>

          {/* 3-year net-positioning index (bullishness / bearishness) */}
          <CotIndexGauge
            categories={displayCategories}
            title={`${report.instrument} — 3-Year Net Positioning Index (${viewLabel})`}
          />

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
