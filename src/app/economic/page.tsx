"use client";

import { useRef, useCallback, useMemo } from "react";
import { useEconomicData } from "@/hooks/useEconomicData";
import { useMarketData } from "@/hooks/useMarketData";
import { useTreasuryData } from "@/hooks/useTreasuryData";
import { EconomicSummaryCard } from "@/components/economic/EconomicSummaryCard";
import { EconomicChart } from "@/components/economic/EconomicChart";
import { TreasuryBondChart } from "@/components/economic/TreasuryBondChart";
import type { EconomicIndicatorData, EconomicDataPoint } from "@/types";

export default function EconomicPage() {
  const inflation = useEconomicData("inflation", "max");
  const unemployment = useEconomicData("unemployment", "max");
  const oil = useEconomicData("oil", "max");
  const tips = useEconomicData("tips", "max");
  const fedrate = useEconomicData("fedrate", "max");
  const gold = useMarketData("gold", "max");
  const dxy = useMarketData("dxy", "max");
  const sp500 = useMarketData("sp500", "max");
  const dowjones = useMarketData("dowjones", "max");
  const vix = useMarketData("vix", "max");
  const treasury = useTreasuryData("max");

  // Derive 10Y Treasury summary from treasury bundle data
  const treasury10y = useMemo((): EconomicIndicatorData | null => {
    if (!treasury.data) return null;
    const series = treasury.data.series.find((s) => s.maturity === "10y");
    if (!series) return null;
    return {
      indicator: "tips", // reuse type — only used for routing
      name: "10Y Treasury Yield",
      currentValue: series.currentValue,
      previousValue: series.previousValue,
      change: series.change,
      unit: "%",
      data: series.data,
      lastUpdated: treasury.data.lastUpdated,
    };
  }, [treasury.data]);

  // Derive 2Y-10Y yield curve spread
  const yieldCurveSpread = useMemo((): EconomicIndicatorData | null => {
    if (!treasury.data) return null;
    const s10 = treasury.data.series.find((s) => s.maturity === "10y");
    const s2 = treasury.data.series.find((s) => s.maturity === "2y");
    if (!s10 || !s2) return null;

    // Build spread time series by matching dates
    const map2y = new Map(s2.data.map((d) => [d.date, d.value]));
    const spreadData: EconomicDataPoint[] = [];
    for (const point of s10.data) {
      const val2y = map2y.get(point.date);
      if (val2y !== undefined) {
        spreadData.push({
          date: point.date,
          value: parseFloat((point.value - val2y).toFixed(2)),
        });
      }
    }

    const currentValue = spreadData.length > 0 ? spreadData[spreadData.length - 1].value : null;
    const previousValue = spreadData.length > 1 ? spreadData[spreadData.length - 2].value : null;
    const change =
      currentValue !== null && previousValue !== null
        ? parseFloat((currentValue - previousValue).toFixed(2))
        : null;

    return {
      indicator: "tips",
      name: "2Y-10Y Yield Spread",
      currentValue,
      previousValue,
      change,
      unit: "bps",
      data: spreadData,
      lastUpdated: treasury.data.lastUpdated,
    };
  }, [treasury.data]);

  // Refs for scroll-to-chart
  const chartRefs = {
    inflation: useRef<HTMLDivElement>(null),
    unemployment: useRef<HTMLDivElement>(null),
    oil: useRef<HTMLDivElement>(null),
    gold: useRef<HTMLDivElement>(null),
    dxy: useRef<HTMLDivElement>(null),
    sp500: useRef<HTMLDivElement>(null),
    dowjones: useRef<HTMLDivElement>(null),
    vix: useRef<HTMLDivElement>(null),
    tips: useRef<HTMLDivElement>(null),
    fedrate: useRef<HTMLDivElement>(null),
    treasury10y: useRef<HTMLDivElement>(null),
    yieldSpread: useRef<HTMLDivElement>(null),
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
    vix.error,
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

      <h2 className="text-base font-display text-text-primary mb-6">Overview</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <EconomicSummaryCard data={inflation.data} loading={inflation.loading} onClick={() => scrollToChart("inflation")} />
        <EconomicSummaryCard data={unemployment.data} loading={unemployment.loading} onClick={() => scrollToChart("unemployment")} />
        <EconomicSummaryCard data={oil.data} loading={oil.loading} onClick={() => scrollToChart("oil")} />
        <EconomicSummaryCard data={gold.data} loading={gold.loading} onClick={() => scrollToChart("gold")} />
        <EconomicSummaryCard data={dxy.data} loading={dxy.loading} onClick={() => scrollToChart("dxy")} />
        <EconomicSummaryCard data={sp500.data} loading={sp500.loading} onClick={() => scrollToChart("sp500")} />
        <EconomicSummaryCard data={dowjones.data} loading={dowjones.loading} onClick={() => scrollToChart("dowjones")} />
        <EconomicSummaryCard data={vix.data} loading={vix.loading} onClick={() => scrollToChart("vix")} />
        <EconomicSummaryCard data={treasury10y} loading={treasury.loading} onClick={() => scrollToChart("treasury10y")} />
        <EconomicSummaryCard data={yieldCurveSpread} loading={treasury.loading} onClick={() => scrollToChart("yieldSpread")} />
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
          />
          <EconomicChart
            data={unemployment.data}
            loading={unemployment.loading}
            title="Unemployment Rate"
            ref={chartRefs.unemployment}
          />
        </div>

        <EconomicChart
          data={oil.data}
          loading={oil.loading}
          title="WTI Crude Oil Price"
          ref={chartRefs.oil}
        />

        {/* Gold and DXY side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EconomicChart
            data={gold.data}
            loading={gold.loading}
            title="Gold"
            ref={chartRefs.gold}
          />
          <EconomicChart
            data={dxy.data}
            loading={dxy.loading}
            title="US Dollar Index (DXY)"
            ref={chartRefs.dxy}
          />
        </div>

        {/* S&P 500 and Dow Jones side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EconomicChart
            data={sp500.data}
            loading={sp500.loading}
            title="S&P 500"
            ref={chartRefs.sp500}
          />
          <EconomicChart
            data={dowjones.data}
            loading={dowjones.loading}
            title="Dow Jones"
            ref={chartRefs.dowjones}
          />
        </div>

        {/* VIX */}
        <EconomicChart
          data={vix.data}
          loading={vix.loading}
          title="VIX"
          ref={chartRefs.vix}
        />

        {/* Federal Funds Rate */}
        <EconomicChart
          data={fedrate.data}
          loading={fedrate.loading}
          title="Federal Funds Rate"
          ref={chartRefs.fedrate}
        />

        {/* 10Y Treasury and Yield Curve Spread side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EconomicChart
            data={treasury10y}
            loading={treasury.loading}
            title="10Y Treasury Yield"
            ref={chartRefs.treasury10y}
          />
          <EconomicChart
            data={yieldCurveSpread}
            loading={treasury.loading}
            title="2Y-10Y Yield Spread"
            ref={chartRefs.yieldSpread}
          />
        </div>

        {/* TIPS and Treasury Yields side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EconomicChart
            data={tips.data}
            loading={tips.loading}
            title="10Y TIPS Yield"
            ref={chartRefs.tips}
          />
          <div>
            <TreasuryBondChart data={treasury.data} loading={treasury.loading} />
          </div>
        </div>
      </div>
    </div>
  );
}
