"use client";

import { useState, useMemo, useEffect } from "react";
import { useFundamentals } from "@/hooks/useFundamentals";
import { useQuotes } from "@/hooks/useQuotes";
import { DcfInputSection } from "@/components/dcf/DcfInputSection";
import { DcfResultCard } from "@/components/dcf/DcfResultCard";
import { DcfFcfChart } from "@/components/dcf/DcfFcfChart";
import { DcfSensitivityTable } from "@/components/dcf/DcfSensitivityTable";
import {
  calculateDcf,
  calculateSensitivity,
  getDefaultDcfInputs,
  rateRange,
} from "@/utils/dcf";
import type { DcfInputs } from "@/types";

export default function DcfPage() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [tickerName, setTickerName] = useState<string | null>(null);
  const [dcfInputs, setDcfInputs] = useState<DcfInputs | null>(null);
  const [noFcfWarning, setNoFcfWarning] = useState(false);

  const { data: fundamentals, loading: fundLoading } = useFundamentals(selectedTicker);
  const { quotes, loading: quoteLoading } = useQuotes(
    selectedTicker ? [selectedTicker] : []
  );

  const quote = selectedTicker ? quotes[selectedTicker] : null;
  const loading = fundLoading || quoteLoading;

  // Auto-populate inputs when data arrives
  useEffect(() => {
    if (!fundamentals || !quote) return;

    const defaults = getDefaultDcfInputs(fundamentals, quote);
    if (defaults) {
      setDcfInputs(defaults);
      setNoFcfWarning(false);
    } else {
      // No FCF data — set defaults with 0 FCF so the user can manually enter
      setDcfInputs({
        startingFcf: 0,
        phase1Years: 5,
        phase1GrowthRate: 0.2,
        phase2Years: 5,
        phase2GrowthRate: 0.08,
        terminalGrowthRate: 0.03,
        discountRate: 0.1,
        totalDebt: fundamentals.annual.at(-1)?.totalDebt ?? 0,
        sharesOutstanding:
          quote.marketCap && quote.currentPrice > 0
            ? quote.marketCap / quote.currentPrice
            : 0,
      });
      setNoFcfWarning(true);
    }
  }, [fundamentals, quote]);

  // Validate inputs
  const validationError = useMemo(() => {
    if (!dcfInputs) return null;
    if (dcfInputs.discountRate <= dcfInputs.terminalGrowthRate) {
      return "Discount rate must be greater than terminal growth rate.";
    }
    if (dcfInputs.sharesOutstanding <= 0) {
      return "Shares outstanding must be greater than zero.";
    }
    return null;
  }, [dcfInputs]);

  // Calculate DCF
  const dcfResult = useMemo(() => {
    if (!dcfInputs || validationError || dcfInputs.startingFcf === 0) return null;
    return calculateDcf(dcfInputs);
  }, [dcfInputs, validationError]);

  // Sensitivity matrix
  const sensitivityData = useMemo(() => {
    if (!dcfInputs || validationError || dcfInputs.startingFcf === 0) return null;
    const growthRates = rateRange(dcfInputs.phase1GrowthRate, [-0.1, -0.05, 0, 0.05, 0.1], 0);
    const discountRates = rateRange(dcfInputs.discountRate, [-0.02, -0.01, 0, 0.01, 0.02]);
    // Make sure all discount rates > terminal growth rate
    const safeDiscountRates = discountRates.filter(
      (dr) => dr > dcfInputs.terminalGrowthRate
    );
    if (safeDiscountRates.length === 0) return null;
    return calculateSensitivity(dcfInputs, growthRates, safeDiscountRates);
  }, [dcfInputs, validationError]);

  function handleTickerSelect(ticker: string, name: string) {
    setSelectedTicker(ticker);
    setTickerName(name);
    setDcfInputs(null);
    setNoFcfWarning(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">DCF Calculator</h1>
        <p className="text-sm text-text-secondary mt-1">
          Multi-stage discounted cash flow valuation model
        </p>
      </div>

      {/* Inputs */}
      <DcfInputSection
        tickerName={tickerName}
        onTickerSelect={handleTickerSelect}
        inputs={dcfInputs}
        onInputsChange={setDcfInputs}
        loading={loading && selectedTicker !== null}
        noFcfWarning={noFcfWarning}
      />

      {/* Validation error */}
      {validationError && dcfInputs && (
        <div className="rounded-lg border border-red-primary/30 bg-red-primary/10 p-4 mb-6 text-sm text-red-primary">
          {validationError}
        </div>
      )}

      {/* Results */}
      {dcfResult && quote && (
        <>
          <DcfResultCard result={dcfResult} currentPrice={quote.currentPrice} />
          <DcfFcfChart
            data={dcfResult.projectedFcf}
            phase1Years={dcfInputs!.phase1Years}
          />
        </>
      )}

      {sensitivityData && quote && (
        <DcfSensitivityTable
          data={sensitivityData}
          currentPrice={quote.currentPrice}
        />
      )}
    </div>
  );
}
