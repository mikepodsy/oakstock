"use client";

import type { DividendEvent } from "@/types";
import { DividendTable } from "@/components/calendar/DividendTable";
import { Skeleton } from "@/components/ui/skeleton";

interface UpcomingDividendsProps {
  data: DividendEvent[];
  loading: boolean;
}

export function UpcomingDividends({ data, loading }: UpcomingDividendsProps) {
  const portfolioOnly = data.filter((e) => e.isPortfolioStock);

  if (loading) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
      <h2 className="text-lg font-display text-text-primary mb-4">
        Upcoming Dividends
      </h2>
      {portfolioOnly.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No upcoming dividend dates for your holdings in the next 30 days.
        </p>
      ) : (
        <DividendTable data={portfolioOnly} />
      )}
    </div>
  );
}
