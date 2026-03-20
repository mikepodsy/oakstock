"use client";

import { Table, CalendarDays } from "lucide-react";

export type ViewMode = "table" | "grid";
export type DatePreset = "this-week" | "this-month" | "next-month";

interface CalendarHeaderProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  from: string;
  to: string;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "this-week", label: "This Week" },
  { key: "this-month", label: "This Month" },
  { key: "next-month", label: "Next Month" },
];

export function CalendarHeader({
  view,
  onViewChange,
  datePreset,
  onDatePresetChange,
  from,
  to,
  onFromChange,
  onToChange,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Date presets */}
      <div className="flex items-center gap-1">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onDatePresetChange(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              datePreset === key
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="flex items-center gap-2 ml-auto">
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="bg-bg-tertiary text-text-primary text-sm px-2 py-1.5 rounded-lg border border-border-primary"
        />
        <span className="text-text-tertiary text-sm">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="bg-bg-tertiary text-text-primary text-sm px-2 py-1.5 rounded-lg border border-border-primary"
        />
      </div>

      {/* View toggle */}
      <div className="flex items-center bg-bg-tertiary rounded-lg p-0.5">
        <button
          onClick={() => onViewChange("table")}
          className={`p-1.5 rounded-md transition-colors ${
            view === "table" ? "bg-bg-elevated text-text-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
          title="Table view"
        >
          <Table className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewChange("grid")}
          className={`p-1.5 rounded-md transition-colors ${
            view === "grid" ? "bg-bg-elevated text-text-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
          title="Calendar view"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
