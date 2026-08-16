"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function BacktestLoadingSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton className="h-24 rounded-xl" key={i} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton className="h-20 rounded-xl" key={i} />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
        <Skeleton className="h-[160px] rounded-xl" />
      </div>
    </div>
  );
}
