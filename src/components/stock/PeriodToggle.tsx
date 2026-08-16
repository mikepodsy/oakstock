"use client";

import type { StatementPeriod } from "@/types";

interface PeriodToggleProps {
  value: StatementPeriod;
  onChange: (period: StatementPeriod) => void;
  /** Periods with no statements are shown but not selectable. */
  disabled?: StatementPeriod[];
}

const OPTIONS: { period: StatementPeriod; label: string }[] = [
  { period: "quarterly", label: "Quarterly" },
  { period: "annual", label: "Annual" },
];

/** The Quarterly/Annual segmented control used by the financials sections. */
export function PeriodToggle({ value, onChange, disabled = [] }: PeriodToggleProps) {
  return (
    <div
      role="group"
      aria-label="Reporting period"
      className="flex rounded-lg border border-border-primary overflow-hidden"
    >
      {OPTIONS.map(({ period, label }) => {
        const isActive = value === period;
        const isDisabled = disabled.includes(period);

        return (
          <button
            key={period}
            type="button"
            onClick={() => onChange(period)}
            disabled={isDisabled}
            aria-pressed={isActive}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-green-primary text-white"
                : isDisabled
                  ? "bg-bg-secondary text-text-tertiary cursor-not-allowed"
                  : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary cursor-pointer"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
