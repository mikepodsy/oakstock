"use client";

import { formatCurrency, formatDate } from "@/utils/formatters";

interface TooltipEntry {
  name: string;
  value: number | null;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  entries: TooltipEntry[];
}

export function ChartTooltip({ active, label, entries }: ChartTooltipProps) {
  if (!active || !label) return null;

  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs text-text-tertiary mb-1">{formatDate(label)}</p>
      {entries.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-text-secondary">{entry.name}</span>
          <span className="text-xs font-financial text-text-primary ml-auto">
            {entry.value !== null ? formatCurrency(entry.value) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
