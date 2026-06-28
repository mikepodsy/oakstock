"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LineChart } from "lucide-react";
import { TickerSearch } from "@/components/search/TickerSearch";
import { useOptionsTickerStore } from "@/stores/optionsTickerStore";

export default function OptionsLandingPage() {
  const router = useRouter();
  const lastTicker = useOptionsTickerStore((s) => s.lastTicker);
  // Wait for the persisted store to hydrate before deciding to redirect, so we
  // don't flash the search page when there's a remembered ticker. Server snapshot
  // is always false (no localStorage), avoiding SSR access to the persist API.
  const hydrated = useSyncExternalStore(
    (cb) => useOptionsTickerStore.persist.onFinishHydration(cb),
    () => useOptionsTickerStore.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    if (hydrated && lastTicker) {
      router.replace(`/options/${lastTicker}`);
    }
  }, [hydrated, lastTicker, router]);

  // Returning user with a remembered ticker → redirecting; render nothing.
  if (!hydrated || lastTicker) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 pt-20">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="rounded-2xl bg-bg-tertiary p-3 mb-4">
          <LineChart className="h-7 w-7 text-oak-300" />
        </div>
        <h1 className="text-2xl font-display text-text-primary mb-1">Option Builder</h1>
        <p className="text-sm text-text-secondary">
          Search a ticker to build option strategies and visualize payoff diagrams.
        </p>
      </div>
      <TickerSearch onSelect={(r) => router.push(`/options/${r.ticker}`)} />
    </div>
  );
}
