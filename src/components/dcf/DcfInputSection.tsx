"use client";

import { TickerSearch } from "@/components/search/TickerSearch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/formatters";
import type { DcfInputs } from "@/types";
import { AlertTriangle } from "lucide-react";

interface DcfInputSectionProps {
  tickerName: string | null;
  onTickerSelect: (ticker: string, name: string) => void;
  inputs: DcfInputs | null;
  onInputsChange: (inputs: DcfInputs) => void;
  loading: boolean;
  noFcfWarning: boolean;
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-text-secondary mb-1">
        {label}
      </label>
      <div className="relative">
        <Input
          type="number"
          step={step}
          min={min}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="bg-bg-tertiary border-border-primary text-text-primary pr-8"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function DcfInputSection({
  tickerName,
  onTickerSelect,
  inputs,
  onInputsChange,
  loading,
  noFcfWarning,
}: DcfInputSectionProps) {
  function update(partial: Partial<DcfInputs>) {
    if (!inputs) return;
    onInputsChange({ ...inputs, ...partial });
  }

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 mb-6">
      {/* Ticker search */}
      <div className="mb-6 max-w-md">
        <label className="block text-sm font-medium text-text-primary mb-2">
          Select Stock
        </label>
        <TickerSearch
          onSelect={(r) => onTickerSelect(r.ticker, r.name)}
        />
        {tickerName && (
          <p className="text-xs text-text-secondary mt-2">{tickerName}</p>
        )}
      </div>

      {loading && <Skeleton className="h-48 rounded-lg" />}

      {noFcfWarning && !loading && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-300">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>
            No free cash flow data available for this company. DCF analysis may not be appropriate, or you can manually enter a starting FCF below.
          </p>
        </div>
      )}

      {inputs && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Company financials */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-4">
              Company Financials
            </h3>
            <div className="space-y-3">
              <NumberField
                label="Starting Free Cash Flow ($)"
                value={inputs.startingFcf}
                onChange={(v) => update({ startingFcf: v })}
                step={1000000}
              />
              <p className="text-[10px] text-text-tertiary -mt-1">
                {formatCompactNumber(inputs.startingFcf)}
              </p>
              <NumberField
                label="Total Debt ($)"
                value={inputs.totalDebt}
                onChange={(v) => update({ totalDebt: v })}
                step={1000000}
              />
              <NumberField
                label="Shares Outstanding"
                value={Math.round(inputs.sharesOutstanding)}
                onChange={(v) => update({ sharesOutstanding: v })}
                step={1000000}
              />
              <p className="text-[10px] text-text-tertiary -mt-1">
                {formatCompactNumber(inputs.sharesOutstanding)}
              </p>
            </div>
          </div>

          {/* Model parameters */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-4">
              Model Parameters
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Phase 1 Years"
                  value={inputs.phase1Years}
                  onChange={(v) => update({ phase1Years: Math.max(1, Math.round(v)) })}
                  min={1}
                />
                <NumberField
                  label="Phase 1 Growth (%)"
                  value={+(inputs.phase1GrowthRate * 100).toFixed(1)}
                  onChange={(v) => update({ phase1GrowthRate: v / 100 })}
                  suffix="%"
                  step={0.5}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Phase 2 Years"
                  value={inputs.phase2Years}
                  onChange={(v) => update({ phase2Years: Math.max(1, Math.round(v)) })}
                  min={1}
                />
                <NumberField
                  label="Phase 2 Growth (%)"
                  value={+(inputs.phase2GrowthRate * 100).toFixed(1)}
                  onChange={(v) => update({ phase2GrowthRate: v / 100 })}
                  suffix="%"
                  step={0.5}
                />
              </div>
              <NumberField
                label="Terminal Growth Rate (%)"
                value={+(inputs.terminalGrowthRate * 100).toFixed(1)}
                onChange={(v) => update({ terminalGrowthRate: v / 100 })}
                suffix="%"
                step={0.5}
              />
              <NumberField
                label="Discount Rate / WACC (%)"
                value={+(inputs.discountRate * 100).toFixed(1)}
                onChange={(v) => update({ discountRate: v / 100 })}
                suffix="%"
                step={0.5}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
