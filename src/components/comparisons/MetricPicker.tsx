"use client";

import { Columns3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { METRIC_IDS, PRESETS, type MetricId } from "@/lib/comps/registry";
import { GROUPED_METRICS } from "./shared";

function sameSet(a: MetricId[], b: MetricId[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function MetricPicker({
  selected,
  onChange,
}: {
  selected: MetricId[];
  onChange: (ids: MetricId[]) => void;
}) {
  const toggle = (id: MetricId, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((x) => x !== id);
    // Keep registry order so columns don't jump around as you toggle.
    onChange(METRIC_IDS.filter((m) => next.includes(m)));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {Object.entries(PRESETS).map(([name, ids]) => (
        <button
          key={name}
          onClick={() => onChange(ids)}
          className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
            sameSet(selected, ids)
              ? "bg-oak-300/20 text-text-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {name}
        </button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border border-border-primary px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary">
          <Columns3 className="size-3.5" /> Metrics ({selected.length})
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-[420px] w-64 overflow-y-auto">
          {GROUPED_METRICS.map((g, i) => (
            <DropdownMenuGroup key={g.group}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
              {g.metrics.map((m) => (
                <DropdownMenuCheckboxItem
                  key={m.id}
                  checked={selected.includes(m.id)}
                  onCheckedChange={(on) => toggle(m.id, on)}
                  closeOnClick={false}
                  title={m.description}
                >
                  {m.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
