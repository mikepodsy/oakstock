"use client";

import { useMomentumSnapshot } from "@/hooks/useMomentumSnapshot";

/** Large-cap momentum snapshot, read from /api/alerts/sp400. */
export function useSp400Momentum() {
  return useMomentumSnapshot("/api/alerts/sp400", "/api/alerts/refresh");
}
