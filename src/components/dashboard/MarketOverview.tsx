"use client";

import { useMarketData } from "@/hooks/useMarketData";
import { EconomicChart } from "@/components/economic/EconomicChart";
import { DispersionCard } from "@/components/dashboard/DispersionCard";
import { RspSpyCandles } from "@/components/dashboard/RspSpyCandles";

export function MarketOverview() {
  const es = useMarketData("es", "5y");
  const nq = useMarketData("nq", "5y");
  const vix = useMarketData("vix", "5y");

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DispersionCard />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EconomicChart data={es.data} loading={es.loading} title="S&P 500 Futures (ES)" />
        <EconomicChart data={nq.data} loading={nq.loading} title="Nasdaq 100 Futures (NQ)" />
        <EconomicChart data={vix.data} loading={vix.loading} title="VIX" />
        <RspSpyCandles />
      </div>
    </div>
  );
}
