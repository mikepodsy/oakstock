"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchOptionChain } from "@/services/options";
import type { OptionChainData } from "@/types/options";
import type { OptionsExpiry } from "@/types";

// Loads option chains for a ticker, one expiry at a time, caching each fetched
// expiry. The initial load (no expiry) returns the listed expiries + spot + the
// nearest expiry's strikes; `ensureExpiry` lazily loads additional expiries as
// legs select them.
export function useOptionChain(ticker: string | null): {
  chains: Record<string, OptionChainData>;
  expiries: OptionsExpiry[];
  spot: number | null;
  defaultExpiry: string | null;
  loading: boolean;
  error: string | null;
  ensureExpiry: (expiry: string) => Promise<void>;
} {
  const [chains, setChains] = useState<Record<string, OptionChainData>>({});
  const [expiries, setExpiries] = useState<OptionsExpiry[]>([]);
  const [spot, setSpot] = useState<number | null>(null);
  const [defaultExpiry, setDefaultExpiry] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against stale responses when the ticker changes mid-flight.
  const tokenRef = useRef(0);
  // Tracks in-flight expiry fetches so we don't double-request.
  const inflight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!ticker) {
      setChains({});
      setExpiries([]);
      setSpot(null);
      setDefaultExpiry(null);
      setError(null);
      return;
    }
    const token = ++tokenRef.current;
    setLoading(true);
    setError(null);
    setChains({});
    inflight.current.clear();

    fetchOptionChain(ticker)
      .then((data) => {
        if (tokenRef.current !== token) return;
        setExpiries(data.expiries);
        setSpot(data.spot);
        setDefaultExpiry(data.expiry);
        setChains({ [data.expiry]: data });
      })
      .catch((e) => {
        if (tokenRef.current !== token) return;
        setError(e instanceof Error ? e.message : "Failed to load options");
      })
      .finally(() => {
        if (tokenRef.current === token) setLoading(false);
      });
  }, [ticker]);

  const ensureExpiry = useCallback(
    async (expiry: string) => {
      if (!ticker || !expiry) return;
      if (chains[expiry] || inflight.current.has(expiry)) return;
      const token = tokenRef.current;
      inflight.current.add(expiry);
      try {
        const data = await fetchOptionChain(ticker, expiry);
        if (tokenRef.current !== token) return;
        setChains((prev) => ({ ...prev, [data.expiry]: data }));
      } catch (e) {
        if (tokenRef.current === token) {
          setError(e instanceof Error ? e.message : "Failed to load expiry");
        }
      } finally {
        inflight.current.delete(expiry);
      }
    },
    [ticker, chains],
  );

  return { chains, expiries, spot, defaultExpiry, loading, error, ensureExpiry };
}
