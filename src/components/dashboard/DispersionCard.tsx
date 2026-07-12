"use client";

import { useMarketData } from "@/hooks/useMarketData";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// VIXEQ − VIX spread bands. Higher spread = more single-stock dispersion, the
// alarming state → red. Tune these once live values are observed.
const YELLOW_THRESHOLD = 1.0;
const RED_THRESHOLD = 3.0;

type Band = {
  label: string;
  dot: string;
  value: string;
  ring: string;
};

function classify(spread: number): Band {
  if (spread >= RED_THRESHOLD) {
    return {
      label: "Elevated",
      dot: "bg-red-primary",
      value: "text-red-primary",
      ring: "border-red-primary/30 bg-red-primary/10",
    };
  }
  if (spread >= YELLOW_THRESHOLD) {
    return {
      label: "Watch",
      dot: "bg-yellow-500",
      value: "text-yellow-500",
      ring: "border-yellow-500/30 bg-yellow-500/10",
    };
  }
  return {
    label: "Calm",
    dot: "bg-green-primary",
    value: "text-green-primary",
    ring: "border-green-primary/30 bg-green-primary/10",
  };
}

export function DispersionCard() {
  const { data, loading } = useMarketData("vixeqVix", "5y");
  const spread = data?.currentValue ?? null;
  const change = data?.change ?? null;

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="h-9 w-24" />
      </div>
    );
  }

  const band = spread !== null ? classify(spread) : null;

  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        band ? band.ring : "border-border-primary bg-bg-secondary"
      )}
    >
      <div className="flex items-center gap-2">
        {band && <span className={cn("h-2 w-2 rounded-full", band.dot)} />}
        <h3 className="text-sm font-display text-text-primary">
          VIXEQ − VIX · Dispersion
        </h3>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            "font-financial text-3xl tabular-nums",
            band ? band.value : "text-text-primary"
          )}
        >
          {spread !== null ? spread.toFixed(2) : "—"}
        </span>
        {band && (
          <span className="text-sm font-medium text-text-secondary">
            {band.label}
          </span>
        )}
      </div>
      {change !== null && (
        <p className="mt-1 text-xs text-text-tertiary tabular-nums">
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)} since prior bar
        </p>
      )}
    </div>
  );
}
