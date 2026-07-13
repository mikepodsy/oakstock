"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchEtfHoldings } from "@/services/yahooFinance";
import type { EtfHoldingsResult } from "@/lib/edgar/nport";

// Fetches an ETF's holdings from its latest SEC NPORT-P filing. Pass null to
// skip (e.g. for non-ETF tickers) so the request only fires for funds.
export function useEtfHoldings(ticker: string | null): {
  data: EtfHoldingsResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<EtfHoldingsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticker) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchEtfHoldings(ticker);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch ETF holdings");
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
