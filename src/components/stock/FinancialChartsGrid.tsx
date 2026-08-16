"use client";

import { useState } from "react";
import { FinancialBarChart } from "@/components/charts/FinancialBarChart";
import { StackedBarChart } from "@/components/charts/StackedBarChart";
import { MarginLineChart } from "@/components/charts/MarginLineChart";
import { PeriodToggle } from "@/components/stock/PeriodToggle";
import type { FundamentalsData, StatementPeriod } from "@/types";

interface FinancialChartsGridProps {
  data: FundamentalsData;
  loading?: boolean;
}

export function FinancialChartsGrid({
  data,
  loading,
}: FinancialChartsGridProps) {
  const [period, setPeriod] = useState<StatementPeriod>("quarterly");

  const statements = period === "quarterly" ? data.quarterly : data.annual;

  const revenueData = statements.map((s) => ({ date: s.date, value: s.revenue }));
  const fcfData = statements.map((s) => ({ date: s.date, value: s.freeCashFlow }));
  const ocfData = statements.map((s) => ({ date: s.date, value: s.operatingCashFlow }));
  const capexData = statements.map((s) => ({ date: s.date, value: s.capex }));
  const netIncomeData = statements.map((s) => ({ date: s.date, value: s.netIncome }));
  const epsData = statements.map((s) => ({ date: s.date, value: s.eps }));
  const epsBasicData = statements.map((s) => ({ date: s.date, value: s.epsBasic }));

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
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FinancialBarChart
          title="Revenue"
          data={revenueData}
          color="#f59e0b"
          loading={loading}
        />
        <FinancialBarChart
          title="Net Income"
          data={netIncomeData}
          color="#a855f7"
          loading={loading}
        />
        <FinancialBarChart
          title="Operating Cash Flow"
          data={ocfData}
          color="#14b8a6"
          loading={loading}
        />
        <FinancialBarChart
          title="Free Cash Flow"
          data={fcfData}
          color="#22c55e"
          loading={loading}
        />
        <FinancialBarChart
          title="Capital Expenditure"
          data={capexData}
          color="#64748b"
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
        <FinancialBarChart
          title="EPS (Basic)"
          data={epsBasicData}
          color="#f43f5e"
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
