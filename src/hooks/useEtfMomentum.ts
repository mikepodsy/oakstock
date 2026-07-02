"use client";

import { useMomentumSnapshot } from "@/hooks/useMomentumSnapshot";

/** ETF momentum snapshot, read from /api/alerts/etf. */
export function useEtfMomentum() {
  return useMomentumSnapshot("/api/alerts/etf", "/api/alerts/etf-refresh");
}
