// Builds the point-in-time term structure (ATM IV per expiry) and front-expiry
// skew from the live Questrade options chain. Server-only (uses questradeGet/Post).
import { questradeGet, questradePost, resolveSymbolId } from "@/lib/questrade";
import { computeSkew } from "@/lib/options/volStats";
import type { ContractQuote, OptionStrikeQuotes } from "@/types/options";
import type { TermStructurePoint, SkewData } from "@/types/volatility";

const QUOTE_BATCH_SIZE = 100;
const SKEW_BAND = 0.4; // ±40% of spot for the skew strikes

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
  volatility: number | null;
  delta: number | null;
}
interface OptionQuotesResponse {
  optionQuotes: OptionQuote[];
}
interface SymbolQuotesResponse {
  quotes: Array<{ lastTradePrice: number | null }>;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const day = (iso: string) => iso.slice(0, 10);
const dteOf = (iso: string) =>
  Math.max(0, Math.ceil((new Date(`${day(iso)}T20:00:00Z`).getTime() - Date.now()) / 86_400_000));

// Pick the strike nearest spot from an expiry's ladder.
function atmStrike(expiry: ChainExpiry, spot: number | null): ChainStrike | null {
  const all = (expiry.chainPerRoot ?? []).flatMap((r) => r.chainPerStrikePrice ?? []);
  if (all.length === 0) return null;
  const anchor = spot ?? all[Math.floor(all.length / 2)].strikePrice;
  return all.reduce((best, s) =>
    Math.abs(s.strikePrice - anchor) < Math.abs(best.strikePrice - anchor) ? s : best,
  );
}

function toContract(q: OptionQuote | undefined): ContractQuote {
  return {
    bid: null, ask: null, last: null, mid: null,
    iv: q?.volatility != null ? q.volatility / 100 : null,
    delta: q?.delta ?? null,
    gamma: null, theta: null, vega: null, rho: null,
    openInterest: null, volume: null,
  };
}

export interface QuestradeVol {
  spot: number | null;
  termStructure: TermStructurePoint[];
  skew: SkewData | null;
}

export async function fetchTermStructureAndSkew(ticker: string): Promise<QuestradeVol> {
  const symbolId = await resolveSymbolId(ticker);
  if (symbolId === null) return { spot: null, termStructure: [], skew: null };

  const [chain, spotData] = await Promise.all([
    questradeGet<OptionChainResponse>(`/v1/symbols/${symbolId}/options`),
    questradeGet<SymbolQuotesResponse>(`/v1/markets/quotes/${symbolId}`).catch(() => null),
  ]);
  const spot = spotData?.quotes[0]?.lastTradePrice ?? null;

  const now = Date.now();
  const future = (chain.optionChain ?? [])
    .filter((e) => new Date(e.expiryDate).getTime() >= now - 86_400_000)
    .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate));
  if (future.length === 0) return { spot, termStructure: [], skew: null };

  // ATM contract ids per expiry (term structure) + all front-expiry strikes
  // within the band (skew). Collect into one id set, then quote in batches.
  const ids = new Set<number>();
  const atmByExpiry = new Map<string, ChainStrike>();
  for (const e of future) {
    const atm = atmStrike(e, spot);
    if (atm) {
      atmByExpiry.set(day(e.expiryDate), atm);
      ids.add(atm.callSymbolId);
      ids.add(atm.putSymbolId);
    }
  }

  const front = future[0];
  const lo = spot ? spot * (1 - SKEW_BAND) : -Infinity;
  const hi = spot ? spot * (1 + SKEW_BAND) : Infinity;
  const frontStrikes: ChainStrike[] = (front.chainPerRoot ?? [])
    .flatMap((r) => r.chainPerStrikePrice ?? [])
    .filter((s) => s.strikePrice >= lo && s.strikePrice <= hi)
    .sort((a, b) => a.strikePrice - b.strikePrice);
  for (const s of frontStrikes) {
    ids.add(s.callSymbolId);
    ids.add(s.putSymbolId);
  }

  const quoteOf = new Map<number, OptionQuote>();
  for (const batch of chunk([...ids], QUOTE_BATCH_SIZE)) {
    const { optionQuotes } = await questradePost<OptionQuotesResponse>(
      "/v1/markets/quotes/options",
      { optionIds: batch },
    );
    for (const q of optionQuotes) quoteOf.set(q.symbolId, q);
  }

  // Term structure: ATM IV per expiry = mean of available call/put vol.
  const termStructure: TermStructurePoint[] = future
    .map((e) => {
      const d = day(e.expiryDate);
      const atm = atmByExpiry.get(d);
      const cv = atm ? quoteOf.get(atm.callSymbolId)?.volatility ?? null : null;
      const pv = atm ? quoteOf.get(atm.putSymbolId)?.volatility ?? null : null;
      const vals = [cv, pv].filter((v): v is number => v != null);
      const atmIv = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length / 100 : null;
      return { expiry: d, dte: dteOf(e.expiryDate), atmIv };
    })
    .filter((t) => t.atmIv != null);

  // Front-expiry skew.
  const skewStrikes: OptionStrikeQuotes[] = frontStrikes.map((s) => ({
    strike: s.strikePrice,
    call: toContract(quoteOf.get(s.callSymbolId)),
    put: toContract(quoteOf.get(s.putSymbolId)),
  }));
  const skew = skewStrikes.length
    ? computeSkew(skewStrikes, spot, day(front.expiryDate))
    : null;

  return { spot, termStructure, skew };
}
