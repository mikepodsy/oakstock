"use client";

import { useEffect, useState } from "react";
import { staticSector } from "@/utils/tickerSector";

interface Meta {
  name: string | null;
  sector: string | null;
}

// Session-lived cache of fetched metadata plus in-flight promises, so each ticker
// hits /api/quote at most once no matter how many rows/hovers request it.
const cache = new Map<string, Meta>();
const inflight = new Map<string, Promise<Meta>>();

async function fetchMeta(ticker: string): Promise<Meta> {
  const cached = cache.get(ticker);
  if (cached) return cached;
  const existing = inflight.get(ticker);
  if (existing) return existing;

  const promise = (async (): Promise<Meta> => {
    try {
      const res = await fetch(`/api/quote?ticker=${encodeURIComponent(ticker)}`);
      if (!res.ok) throw new Error(`quote failed (${res.status})`);
      const data = (await res.json()) as { name?: unknown; sector?: unknown };
      const meta: Meta = {
        name: typeof data.name === "string" ? data.name : null,
        sector: typeof data.sector === "string" ? data.sector : null,
      };
      cache.set(ticker, meta);
      return meta;
    } catch {
      // Negative-cache so a failing ticker doesn't refetch on every hover.
      const meta: Meta = { name: null, sector: null };
      cache.set(ticker, meta);
      return meta;
    } finally {
      inflight.delete(ticker);
    }
  })();

  inflight.set(ticker, promise);
  return promise;
}

/**
 * Resolves a ticker's display name + sector for the hover card. Prefers the known
 * `name` and the static sector map; only when `enabled` (the card is open) and one
 * of them is still missing does it lazily fetch /api/quote (cached per session).
 */
export function useTickerMeta(
  ticker: string,
  knownName: string | null | undefined,
  enabled: boolean
) {
  const staticName = knownName ?? null;
  const staticSec = staticSector(ticker);
  const needFetch = enabled && (!staticName || !staticSec);

  const [fetched, setFetched] = useState<Meta | null>(() => cache.get(ticker) ?? null);

  useEffect(() => {
    if (!needFetch || fetched) return;
    let active = true;
    fetchMeta(ticker).then((meta) => {
      if (active) setFetched(meta);
    });
    return () => {
      active = false;
    };
  }, [ticker, needFetch, fetched]);

  const name = staticName ?? fetched?.name ?? null;
  const sector = staticSec ?? fetched?.sector ?? null;
  // Still resolving when a fetch is warranted but nothing has landed yet.
  const loading = needFetch && fetched === null && !name && !sector;

  return { name, sector, loading };
}
