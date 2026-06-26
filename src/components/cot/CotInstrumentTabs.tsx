"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import type { CotReport, CotGroup } from "@/types";

interface CotInstrumentTabsProps {
  reports: CotReport[];
  selected: string;
  onSelect: (instrument: string) => void;
}

// Fixed display order for the group dropdowns, independent of report arrival order.
const GROUP_ORDER: CotGroup[] = ["Indices", "Metals", "FX", "Energy"];

export function CotInstrumentTabs({ reports, selected, onSelect }: CotInstrumentTabsProps) {
  // Bucket reports by group, preserving config order within each group.
  const byGroup = new Map<string, CotReport[]>();
  for (const r of reports) {
    if (!byGroup.has(r.group)) byGroup.set(r.group, []);
    byGroup.get(r.group)!.push(r);
  }
  const groups = [...byGroup.keys()].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a as CotGroup) - GROUP_ORDER.indexOf(b as CotGroup)
  );

  return (
    <div className="flex gap-2 flex-wrap">
      {groups.map((group) => {
        const items = byGroup.get(group)!;
        const active = items.find((r) => r.instrument === selected);
        return (
          <DropdownMenu key={group}>
            <DropdownMenuTrigger
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                active
                  ? "bg-green-muted text-green-primary"
                  : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              }`}
            >
              {active ? `${group} · ${active.instrument}` : group}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={selected} onValueChange={onSelect}>
                {items.map((r) => (
                  <DropdownMenuRadioItem key={r.instrument} value={r.instrument}>
                    {r.instrument}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}
