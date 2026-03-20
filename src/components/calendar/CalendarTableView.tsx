"use client";

import type { CalendarType, CalendarEvent, EarningsEvent, DividendEvent, EconomicEvent, IpoEvent } from "@/types";
import { EarningsTable } from "./EarningsTable";
import { DividendTable } from "./DividendTable";
import { EconomicTable } from "./EconomicTable";
import { IpoTable } from "./IpoTable";
import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarTableViewProps {
  type: CalendarType;
  data: CalendarEvent[];
  loading: boolean;
}

const TYPE_LABELS: Record<CalendarType, string> = {
  earnings: "earnings",
  dividends: "dividend",
  economic: "economic",
  ipo: "IPO",
};

export function CalendarTableView({ type, data, loading }: CalendarTableViewProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
        <CalendarDays className="h-12 w-12 mb-3" />
        <p className="text-sm">No {TYPE_LABELS[type]} events in this date range</p>
      </div>
    );
  }

  switch (type) {
    case "earnings":
      return <EarningsTable data={data as EarningsEvent[]} />;
    case "dividends":
      return <DividendTable data={data as DividendEvent[]} />;
    case "economic":
      return <EconomicTable data={data as EconomicEvent[]} />;
    case "ipo":
      return <IpoTable data={data as IpoEvent[]} />;
  }
}
