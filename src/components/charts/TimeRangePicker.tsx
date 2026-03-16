"use client";

import { TIME_RANGES } from "@/utils/constants";

interface TimeRangePickerProps {
  selected: string;
  onSelect: (period: string) => void;
}

export function TimeRangePicker({ selected, onSelect }: TimeRangePickerProps) {
  return (
    <div className="flex gap-1">
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onSelect(range.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selected === range.value
              ? "bg-green-primary text-white"
              : "bg-transparent border border-border-primary text-text-secondary hover:text-text-primary"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
