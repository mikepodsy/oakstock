"use client";

import { useEffect, useState } from "react";
import type { CompRow } from "@/lib/comps/metrics";
import type { PeerResult } from "@/lib/comps/peers";
import type { HistoryPoint } from "@/lib/comps/history";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch JSON for `url` (null = idle). Stale responses are dropped when the
 * URL changes mid-flight, so fast peer edits never flash an older table.
 */
function useJson<T>(url: string | null): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when idle
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        return body as T;
      })
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Request failed" }))
      );
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

export function usePeers(ticker: string | null, refreshKey = 0) {
  return useJson<PeerResult>(
    ticker
      ? `/api/comps/peers?ticker=${encodeURIComponent(ticker)}${refreshKey ? "&refresh=1" : ""}`
      : null
  );
}

export function useCompRows(tickers: string[]) {
  const key = tickers.join(",");
  return useJson<{ rows: CompRow[] }>(key ? `/api/comps?tickers=${encodeURIComponent(key)}` : null);
}

export function useCompHistory(ticker: string | null, peers: string[]) {
  return useJson<{ metric: "pe"; points: HistoryPoint[] }>(
    ticker
      ? `/api/comps/history?ticker=${encodeURIComponent(ticker)}&peers=${encodeURIComponent(peers.join(","))}`
      : null
  );
}
