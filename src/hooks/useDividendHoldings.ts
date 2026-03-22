"use client";

import { useState, useEffect, useMemo } from "react";
import type { DividendHolding, BatchFinancialData } from "@/types";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { fetchBatchFinancials } from "@/services/yahooFinance";
import { totalShares, avgCostBasis } from "@/utils/calculations";

export function useDividendHoldings() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const initialized = usePortfolioStore((s) => s.initialized);
  const [financials, setFinancials] = useState<BatchFinancialData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allTickers = useMemo(() => {
    const tickers = new Set<string>();
    for (const p of portfolios) {
      for (const h of p.holdings) {
        tickers.add(h.ticker);
      }
    }
    return Array.from(tickers);
  }, [portfolios]);

  useEffect(() => {
    if (!initialized || allTickers.length === 0) {
      setFinancials([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchBatchFinancials(allTickers);
        if (!cancelled) setFinancials(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dividend data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [allTickers, initialized]);

  const holdings = useMemo<DividendHolding[]>(() => {
    const financialsMap = new Map<string, BatchFinancialData>();
    for (const f of financials) {
      financialsMap.set(f.ticker, f);
    }

    const result: DividendHolding[] = [];

    for (const portfolio of portfolios) {
      for (const holding of portfolio.holdings) {
        const fin = financialsMap.get(holding.ticker);
        if (!fin || fin.error) continue;

        const yield_ = fin.dividendYield ?? 0;
        const rate = fin.dividendRate ?? 0;

        // Dividend stock: yield > 0 OR rate > 0
        if (yield_ <= 0 && rate <= 0) continue;

        const shares = totalShares(holding.lots);
        const costBasis = avgCostBasis(holding.lots);
        const price = fin.currentPrice ?? 0;

        result.push({
          holdingId: holding.id,
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          ticker: holding.ticker,
          name: holding.name,
          currency: holding.currency,
          totalShares: shares,
          avgCostBasis: costBasis,
          currentPrice: price,
          dividendYield: yield_,
          annualDividendPerShare: rate,
          annualIncome: rate * shares,
          yieldOnCost: costBasis > 0 ? rate / costBasis : 0,
        });
      }
    }

    return result;
  }, [portfolios, financials]);

  return { holdings, loading, error };
}
