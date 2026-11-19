"use client";

import { GROUPED_METRICS } from "./shared";
import type { MetricId } from "@/lib/comps/registry";

/** A grouped native <select> over every metric — used for chart axes. */
export function MetricSelect({
  value,
  onChange,
  label,
}: {
  value: MetricId;
  onChange: (id: MetricId) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-text-secondary">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MetricId)}
        className="rounded-md border border-border-primary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
      >
        {GROUPED_METRICS.map((g) => (
          <optgroup key={g.group} label={g.label}>
            {g.metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
