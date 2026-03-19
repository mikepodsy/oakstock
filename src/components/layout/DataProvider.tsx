"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useWatchlistStore } from "@/stores/watchlistStore";

/**
 * Hydrates Zustand stores from Supabase once the user is authenticated.
 * Renders nothing — purely a side-effect component.
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const loadPortfolios = usePortfolioStore((s) => s.loadPortfolios);
  const loadWatchlists = useWatchlistStore((s) => s.loadWatchlists);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadPortfolios();
      loadWatchlists();
    }
  }, [isLoaded, isSignedIn, loadPortfolios, loadWatchlists]);

  return <>{children}</>;
}
