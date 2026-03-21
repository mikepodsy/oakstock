"use client";

import { BENCHMARK_GROUPS } from "@/utils/constants";

interface BenchmarkSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}

export function BenchmarkSelect({ value, onChange, className, id }: BenchmarkSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {BENCHMARK_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.items.map((item) => (
            <option key={item.ticker} value={item.ticker}>
              {item.name} ({item.ticker})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
