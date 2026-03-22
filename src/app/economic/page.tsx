"use client";

import { useState, useRef, useCallback } from "react";
import type { EconomicTimeRange } from "@/types";
import { useEconomicData } from "@/hooks/useEconomicData";
import { useMarketData } from "@/hooks/useMarketData";
import { useTreasuryData } from "@/hooks/useTreasuryData";
import { EconomicSummaryCard } from "@/components/economic/EconomicSummaryCard";
import { EconomicChart } from "@/components/economic/EconomicChart";
import { TreasuryBondChart } from "@/components/economic/TreasuryBondChart";

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
  const tips = useEconomicData("tips", timeRange);
  const fedrate = useEconomicData("fedrate", timeRange);
  const gold = useMarketData("gold", timeRange);
  const dxy = useMarketData("dxy", timeRange);
  const sp500 = useMarketData("sp500", timeRange);
  const dowjones = useMarketData("dowjones", timeRange);
  const treasury = useTreasuryData(timeRange);

  // Refs for scroll-to-chart
  const chartRefs = {
    inflation: useRef<HTMLDivElement>(null),
    unemployment: useRef<HTMLDivElement>(null),
    oil: useRef<HTMLDivElement>(null),
    gold: useRef<HTMLDivElement>(null),
    dxy: useRef<HTMLDivElement>(null),
    sp500: useRef<HTMLDivElement>(null),
    dowjones: useRef<HTMLDivElement>(null),
    tips: useRef<HTMLDivElement>(null),
    fedrate: useRef<HTMLDivElement>(null),
  };

  const scrollToChart = useCallback((key: keyof typeof chartRefs) => {
    chartRefs[key].current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const allErrors = [
    inflation.error,
    unemployment.error,
    oil.error,
    tips.error,
    fedrate.error,
    gold.error,
    dxy.error,
    sp500.error,
    dowjones.error,
    treasury.error,
  ].filter(Boolean);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">
          Economic Indicators
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Key macroeconomic and market data
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
        <EconomicSummaryCard data={inflation.data} loading={inflation.loading} onClick={() => scrollToChart("inflation")} />
        <EconomicSummaryCard data={unemployment.data} loading={unemployment.loading} onClick={() => scrollToChart("unemployment")} />
        <EconomicSummaryCard data={oil.data} loading={oil.loading} onClick={() => scrollToChart("oil")} />
        <EconomicSummaryCard data={gold.data} loading={gold.loading} onClick={() => scrollToChart("gold")} />
        <EconomicSummaryCard data={dxy.data} loading={dxy.loading} onClick={() => scrollToChart("dxy")} />
        <EconomicSummaryCard data={sp500.data} loading={sp500.loading} onClick={() => scrollToChart("sp500")} />
        <EconomicSummaryCard data={dowjones.data} loading={dowjones.loading} onClick={() => scrollToChart("dowjones")} />
        <EconomicSummaryCard data={tips.data} loading={tips.loading} onClick={() => scrollToChart("tips")} />
        <EconomicSummaryCard data={fedrate.data} loading={fedrate.loading} onClick={() => scrollToChart("fedrate")} />
      </div>

      {/* Error */}
      {allErrors.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-muted text-red-primary text-sm">
          {allErrors[0]}
        </div>
      )}

      {/* Charts */}
      <div className="space-y-6">
        {/* Inflation and Unemployment side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EconomicChart
            data={inflation.data}
            loading={inflation.loading}
            title="Inflation Rate (CPI YoY)"
            ref={chartRefs.inflation}
            pageRange={timeRange}
          />
          <EconomicChart
            data={unemployment.data}
            loading={unemployment.loading}
            title="Unemployment Rate"
            ref={chartRefs.unemployment}
            pageRange={timeRange}
          />
        </div>

        <EconomicChart
          data={oil.data}
          loading={oil.loading}
          title="WTI Crude Oil Price"
          ref={chartRefs.oil}
          pageRange={timeRange}
        />

        {/* Gold and DXY side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EconomicChart
            data={gold.data}
            loading={gold.loading}
            title="Gold"
            ref={chartRefs.gold}
            pageRange={timeRange}
          />
          <EconomicChart
            data={dxy.data}
            loading={dxy.loading}
            title="US Dollar Index (DXY)"
            ref={chartRefs.dxy}
            pageRange={timeRange}
          />
        </div>

        {/* S&P 500 and Dow Jones side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EconomicChart
            data={sp500.data}
            loading={sp500.loading}
            title="S&P 500"
            ref={chartRefs.sp500}
            pageRange={timeRange}
          />
          <EconomicChart
            data={dowjones.data}
            loading={dowjones.loading}
            title="Dow Jones"
            ref={chartRefs.dowjones}
            pageRange={timeRange}
          />
        </div>

        {/* Federal Funds Rate */}
        <EconomicChart
          data={fedrate.data}
          loading={fedrate.loading}
          title="Federal Funds Rate"
          ref={chartRefs.fedrate}
          pageRange={timeRange}
        />

        {/* TIPS and Treasury Yields side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EconomicChart
            data={tips.data}
            loading={tips.loading}
            title="10Y TIPS Yield"
            ref={chartRefs.tips}
            pageRange={timeRange}
          />
          <div>
            <TreasuryBondChart data={treasury.data} loading={treasury.loading} />
          </div>
        </div>
      </div>
    </div>
  );
}
