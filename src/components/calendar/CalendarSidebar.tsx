"use client";

import { TrendingUp, DollarSign, Globe, Rocket } from "lucide-react";
import type { CalendarType } from "@/types";

const CALENDAR_CATEGORIES: {
  type: CalendarType;
  label: string;
  icon: React.ElementType;
}[] = [
  { type: "earnings", label: "Earnings", icon: TrendingUp },
  { type: "dividends", label: "Dividends", icon: DollarSign },
  { type: "economic", label: "Economic", icon: Globe },
  { type: "ipo", label: "IPO", icon: Rocket },
];

interface CalendarSidebarProps {
  selected: CalendarType;
  onSelect: (type: CalendarType) => void;
  counts: Record<CalendarType, number>;
}

export function CalendarSidebar({ selected, onSelect, counts }: CalendarSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 bg-bg-secondary rounded-xl border border-border-primary p-2 gap-1 h-fit">
        {CALENDAR_CATEGORIES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
              selected === type
                ? "text-green-primary bg-green-muted border-l-2 border-green-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {counts[type] > 0 && (
              <span className="text-xs bg-bg-tertiary text-text-tertiary px-1.5 py-0.5 rounded-full">
                {counts[type]}
              </span>
            )}
          </button>
        ))}
      </aside>

      {/* Mobile horizontal tabs */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-2 border-b border-border-primary mb-4">
        {CALENDAR_CATEGORIES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selected === type
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
