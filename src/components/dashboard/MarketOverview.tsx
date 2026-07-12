"use client";

import { DispersionCard } from "@/components/dashboard/DispersionCard";
import { MarketStatCard } from "@/components/dashboard/MarketStatCard";
import { CandleTile } from "@/components/dashboard/CandleTile";

export function MarketOverview() {
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DispersionCard />
        <MarketStatCard title="Gold" symbol="gold" prefix="$" />
        <MarketStatCard title="S&P 500 (SPX)" symbol="sp500" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CandleTile title="S&P 500 Futures (ES)" symbol="es" />
        <CandleTile title="Nasdaq 100 Futures (NQ)" symbol="nq" />
        <CandleTile title="VIX" symbol="vix" />
        <CandleTile title="RSP / SPY (Breadth)" symbol="rspSpy" precision={4} />
      </div>
    </div>
  );
}
