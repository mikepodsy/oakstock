import { Skeleton } from "@/components/ui/skeleton";

export function CotLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </div>
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </div>
    </div>
  );
}
