"use client";

import { useState } from "react";
import { FinancialBarChart } from "@/components/charts/FinancialBarChart";
import { StackedBarChart } from "@/components/charts/StackedBarChart";
import { MarginLineChart } from "@/components/charts/MarginLineChart";
import type { FundamentalsData } from "@/types";

interface FinancialChartsGridProps {
  data: FundamentalsData;
  loading?: boolean;
}

type Period = "quarterly" | "annual";

export function FinancialChartsGrid({
  data,
  loading,
}: FinancialChartsGridProps) {
  const [period, setPeriod] = useState<Period>("quarterly");

  const statements = period === "quarterly" ? data.quarterly : data.annual;

  const revenueData = statements.map((s) => ({ date: s.date, value: s.revenue }));
  const ebitdaData = statements.map((s) => ({ date: s.date, value: s.ebitda }));
  const fcfData = statements.map((s) => ({ date: s.date, value: s.freeCashFlow }));
  const netIncomeData = statements.map((s) => ({ date: s.date, value: s.netIncome }));
  const epsData = statements.map((s) => ({ date: s.date, value: s.eps }));

  const buybackDividendData = statements.map((s) => ({
    date: s.date,
    series1: s.buybacks,
    series2: s.dividendsPaid,
  }));

  const debtEquityData = statements.map((s) => ({
    date: s.date,
    series1: s.totalDebt,
    series2: s.stockholdersEquity,
  }));

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-semibold text-text-primary">
          Financials
        </h2>
        <div className="flex rounded-lg border border-border-primary overflow-hidden">
          <button
            onClick={() => setPeriod("quarterly")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              period === "quarterly"
                ? "bg-green-primary text-white"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
            }`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setPeriod("annual")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              period === "annual"
                ? "bg-green-primary text-white"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
            }`}
          >
            Annual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FinancialBarChart
          title="Revenue"
          data={revenueData}
          color="#f59e0b"
          loading={loading}
        />
        <FinancialBarChart
          title="EBITDA"
          data={ebitdaData}
          color="#3b82f6"
          loading={loading}
        />
        <FinancialBarChart
          title="Free Cash Flow"
          data={fcfData}
          color="#22c55e"
          loading={loading}
        />
        <FinancialBarChart
          title="Net Income"
          data={netIncomeData}
          color="#a855f7"
          loading={loading}
        />
        <FinancialBarChart
          title="EPS (Diluted)"
          data={epsData}
          color="#ec4899"
          loading={loading}
          valuePrefix=""
          formatValue={(v) => v.toFixed(2)}
        />
        <StackedBarChart
          title="Buybacks & Dividends"
          data={buybackDividendData}
          series1Color="#ef4444"
          series2Color="#f97316"
          series1Label="Buybacks"
          series2Label="Dividends"
          loading={loading}
        />
        <MarginLineChart
          title="Margins"
          data={statements}
          loading={loading}
        />
        <StackedBarChart
          title="Debt vs Equity"
          data={debtEquityData}
          series1Color="#ef4444"
          series2Color="#3b82f6"
          series1Label="Debt"
          series2Label="Equity"
          loading={loading}
        />
      </div>
    </div>
  );
}
