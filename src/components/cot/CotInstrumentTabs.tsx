"use client";

import type { CotReport } from "@/types";

interface CotInstrumentTabsProps {
  reports: CotReport[];
  selected: string;
  onSelect: (instrument: string) => void;
}

export function CotInstrumentTabs({ reports, selected, onSelect }: CotInstrumentTabsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {reports.map((r) => (
        <button
          key={r.instrument}
          type="button"
          aria-pressed={selected === r.instrument}
          onClick={() => onSelect(r.instrument)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selected === r.instrument
              ? "bg-green-muted text-green-primary"
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          }`}
        >
          {r.instrument}
        </button>
      ))}
    </div>
  );
}
