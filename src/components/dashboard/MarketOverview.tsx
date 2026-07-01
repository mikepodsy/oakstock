"use client";

import { useMarketData } from "@/hooks/useMarketData";
import { EconomicChart } from "@/components/economic/EconomicChart";

export function MarketOverview() {
  const es = useMarketData("es", "5y");
  const nq = useMarketData("nq", "5y");
  const rspSpy = useMarketData("rspSpy", "5y");
  const vix = useMarketData("vix", "5y");
  const vixeqVix = useMarketData("vixeqVix", "5y");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <EconomicChart data={es.data} loading={es.loading} title="S&P 500 Futures (ES)" />
      <EconomicChart data={nq.data} loading={nq.loading} title="Nasdaq 100 Futures (NQ)" />
      <EconomicChart data={rspSpy.data} loading={rspSpy.loading} title="RSP / SPY (Breadth)" />
      <EconomicChart data={vix.data} loading={vix.loading} title="VIX" />
      <div className="lg:col-span-2">
        <EconomicChart
          data={vixeqVix.data}
          loading={vixeqVix.loading}
          title="VIXEQ − VIX (Dispersion)"
        />
      </div>
    </div>
  );
}
