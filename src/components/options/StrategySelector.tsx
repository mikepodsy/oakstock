"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { STRATEGIES, STRATEGY_BY_VALUE } from "@/lib/options/strategies";
import type { StrategyType } from "@/types/options";

export function StrategySelector({
  value,
  onChange,
  disabled,
}: {
  value: StrategyType;
  onChange: (s: StrategyType) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-bg-tertiary border border-border-primary text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer disabled:opacity-50"
      >
        {STRATEGY_BY_VALUE[value]?.label ?? "Select strategy"}
        <ChevronDown className="h-4 w-4 text-text-secondary" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as StrategyType)}
        >
          {STRATEGIES.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={s.value}>
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
