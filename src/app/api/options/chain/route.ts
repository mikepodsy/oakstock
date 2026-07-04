import { NextRequest, NextResponse } from "next/server";
import { questradeGet, questradePost, resolveSymbolId } from "@/lib/questrade";
import { optionChainCache } from "@/lib/cache";
import { chunk } from "@/lib/chunk";
import type { OptionsExpiry } from "@/types";
import type {
  ContractQuote,
  OptionStrikeQuotes,
  OptionChainData,
} from "@/types/options";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
};

// Questrade caps option-quote requests; stay well under it per batch.
const QUOTE_BATCH_SIZE = 100;
// Limit strikes to a band around spot so the builder stays within a couple of
// quote batches. ±40% covers anything a strategy scaffold needs.
const STRIKE_BAND = 0.4;

// ── Questrade response shapes ───────────────────────────
interface ChainStrike {
  strikePrice: number;
  callSymbolId: number;
  putSymbolId: number;
}
interface ChainExpiry {
  expiryDate: string;
  chainPerRoot: Array<{ chainPerStrikePrice: ChainStrike[] }>;
}
interface OptionChainResponse {
  optionChain: ChainExpiry[];
}
interface OptionQuote {
  symbolId: number;
  bidPrice: number | null;
  askPrice: number | null;
  lastTradePrice: number | null;
  volatility: number | null; // percent, e.g. 57.0
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  openInterest: number | null;
  volume: number | null;
}
interface OptionQuotesResponse {
  optionQuotes: OptionQuote[];
}
interface SymbolQuotesResponse {
  quotes: Array<{ lastTradePrice: number | null }>;
}

function expiryDay(expiryDate: string): string {
  return expiryDate.slice(0, 10);
}

function formatExpiryLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  });
}

// Mid from bid/ask, falling back to last trade when a side is missing.
function mid(bid: number | null, ask: number | null, last: number | null): number | null {
  if (bid != null && ask != null && bid > 0 && ask > 0) return (bid + ask) / 2;
  return last ?? null;
}

// Build a ContractQuote from a raw Questrade option quote. Volatility is a
// percent on the wire; we store it as a fraction.
function toContract(q: OptionQuote | undefined): ContractQuote {
  if (!q) {
    return {
      bid: null, ask: null, last: null, mid: null, iv: null,
      delta: null, gamma: null, theta: null, vega: null, rho: null,
      openInterest: null, volume: null,
    };
  }
  return {
    bid: q.bidPrice,
    ask: q.askPrice,
    last: q.lastTradePrice,
    mid: mid(q.bidPrice, q.askPrice, q.lastTradePrice),
    iv: q.volatility != null ? q.volatility / 100 : null,
    delta: q.delta,
    gamma: q.gamma,
    theta: q.theta,
    vega: q.vega,
    rho: q.rho,
    openInterest: q.openInterest,
    volume: q.volume,
  };
}

async function fetchSpot(symbolId: number): Promise<number | null> {
  try {
    const data = await questradeGet<SymbolQuotesResponse>(
      `/v1/markets/quotes/${symbolId}`,
    );
    return data.quotes[0]?.lastTradePrice ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const expiryParam = request.nextUrl.searchParams.get("expiry");

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 },
    );
  }

  const cacheKey = `${ticker.toUpperCase()}:${expiryParam ?? "front"}`;
  const cached = optionChainCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const symbolId = await resolveSymbolId(ticker);
    if (symbolId === null) {
      return NextResponse.json(
        { error: `No Questrade symbol found for '${ticker}'` },
        { status: 404 },
      );
    }

    const [chain, spot] = await Promise.all([
      questradeGet<OptionChainResponse>(`/v1/symbols/${symbolId}/options`),
      fetchSpot(symbolId),
    ]);

    const now = Date.now();
    const future = (chain.optionChain ?? [])
      .filter((e) => new Date(e.expiryDate).getTime() >= now - 86_400_000)
      .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate));

    if (future.length === 0) {
      return NextResponse.json(
        { error: `No listed option expiries for '${ticker}'` },
        { status: 404 },
      );
    }

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const expiries: OptionsExpiry[] = future.map((e) => {
      const day = expiryDay(e.expiryDate);
      return { date: day, label: formatExpiryLabel(day), isZeroDte: day === today };
    });

    // Resolve the target expiry: requested (if listed) else nearest future.
    const target =
      future.find((e) => expiryDay(e.expiryDate) === expiryParam) ?? future[0];
    const targetDay = expiryDay(target.expiryDate);

    // Collect call/put ids within the strike band, keyed by strike.
    const lo = spot ? spot * (1 - STRIKE_BAND) : -Infinity;
    const hi = spot ? spot * (1 + STRIKE_BAND) : Infinity;
    const idsByStrike = new Map<number, { callId: number; putId: number }>();
    const ids: number[] = [];

    for (const root of target.chainPerRoot ?? []) {
      for (const s of root.chainPerStrikePrice ?? []) {
        if (s.strikePrice < lo || s.strikePrice > hi) continue;
        idsByStrike.set(s.strikePrice, {
          callId: s.callSymbolId,
          putId: s.putSymbolId,
        });
        ids.push(s.callSymbolId, s.putSymbolId);
      }
    }

    // Fetch per-contract quotes and fold them back into per-strike rows.
    const quoteOf = new Map<number, OptionQuote>();
    for (const batch of chunk(ids, QUOTE_BATCH_SIZE)) {
      const { optionQuotes } = await questradePost<OptionQuotesResponse>(
        "/v1/markets/quotes/options",
        { optionIds: batch },
      );
      for (const q of optionQuotes) quoteOf.set(q.symbolId, q);
    }

    const strikes: OptionStrikeQuotes[] = [...idsByStrike.keys()]
      .sort((a, b) => a - b)
      .map((strike) => {
        const { callId, putId } = idsByStrike.get(strike)!;
        return {
          strike,
          call: toContract(quoteOf.get(callId)),
          put: toContract(quoteOf.get(putId)),
        };
      });

    const payload: OptionChainData = {
      ticker: ticker.toUpperCase(),
      spot,
      asOf: new Date().toISOString(),
      expiry: targetDay,
      expiries,
      strikes,
    };

    optionChainCache.set(cacheKey, payload);
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Failed to fetch option chain for ${ticker}`, detail: message },
      { status: 500 },
    );
  }
}
