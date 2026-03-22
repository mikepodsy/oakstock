"use client";

import { useState } from "react";
import type { EconomicTimeRange } from "@/types";
import { useEconomicData } from "@/hooks/useEconomicData";
import { EconomicSummaryCard } from "@/components/economic/EconomicSummaryCard";
import { EconomicChart } from "@/components/economic/EconomicChart";

const TIME_RANGES: { label: string; value: EconomicTimeRange }[] = [
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "5Y", value: "5y" },
  { label: "10Y", value: "10y" },
  { label: "MAX", value: "max" },
];

export default function EconomicPage() {
  const [timeRange, setTimeRange] = useState<EconomicTimeRange>("5y");

  const inflation = useEconomicData("inflation", timeRange);
  const unemployment = useEconomicData("unemployment", timeRange);
  const oil = useEconomicData("oil", timeRange);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">
          Economic Indicators
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Key macroeconomic data from the Federal Reserve (FRED)
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-base font-display text-text-primary">Overview</h2>
        <div className="flex gap-1 rounded-lg bg-bg-tertiary p-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeRange === r.value
                  ? "bg-bg-secondary text-text-primary shadow-sm"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <EconomicSummaryCard data={inflation.data} loading={inflation.loading} />
        <EconomicSummaryCard
          data={unemployment.data}
          loading={unemployment.loading}
        />
        <EconomicSummaryCard data={oil.data} loading={oil.loading} />
      </div>

      {/* Error */}
      {(inflation.error || unemployment.error || oil.error) && (
        <div className="mb-4 p-3 rounded-lg bg-red-muted text-red-primary text-sm">
          {inflation.error || unemployment.error || oil.error}
        </div>
      )}

      {/* Charts */}
      <div className="space-y-6">
        <EconomicChart
          data={inflation.data}
          loading={inflation.loading}
          title="Inflation Rate (CPI Year-over-Year)"
        />
        <EconomicChart
          data={unemployment.data}
          loading={unemployment.loading}
          title="Unemployment Rate"
        />
        <EconomicChart
          data={oil.data}
          loading={oil.loading}
          title="WTI Crude Oil Price"
        />
      </div>
    </div>
  );
}
