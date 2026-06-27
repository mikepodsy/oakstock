import { NextRequest, NextResponse } from "next/server";
import { questradeGet, questradePost, resolveSymbolId } from "@/lib/questrade";
import { questradeOptionsCache } from "@/lib/cache";
import type {
  ExpiryWindow,
  OptionsChainResponse,
  OptionStrikeRow,
  OptionsExpiry,
} from "@/types";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
};

// Questrade caps option-quote requests; stay well under it per batch.
const QUOTE_BATCH_SIZE = 100;
// Only aggregate strikes within this band around spot. Far-OTM strikes never
// show on the price-aligned histogram and only inflate the API call count.
const STRIKE_BAND = 0.4; // ±40% of spot

const VALID_WINDOWS: ExpiryWindow[] = ["front", "2w", "monthly", "all"];

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
  volume: number | null;
  openInterest: number | null;
  gamma: number | null;
}
interface OptionQuotesResponse {
  optionQuotes: OptionQuote[];
}
interface SymbolQuotesResponse {
  quotes: Array<{ lastTradePrice: number | null }>;
}

// Approximate zero-gamma flip: walk strikes low→high accumulating net GEX and
// linearly interpolate the price where the running total crosses zero.
function computeFlip(rows: OptionStrikeRow[]): number | null {
  let cum = 0;
  for (let i = 0; i < rows.length; i++) {
    const prev = cum;
    cum += rows[i].gex;
    if (i > 0 && prev !== 0 && Math.sign(cum) !== Math.sign(prev)) {
      const s0 = rows[i - 1].strike;
      const s1 = rows[i].strike;
      const t = prev / (prev - cum); // fraction of the gap where cum hits 0
      return Number((s0 + t * (s1 - s0)).toFixed(2));
    }
  }
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Canonical YYYY-MM-DD for an expiry (Questrade returns it with a TZ offset).
function expiryDay(expiryDate: string): string {
  return expiryDate.slice(0, 10);
}

function formatExpiryLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Pick which expiries fall inside the requested window. Always future-dated.
function selectExpiries(
  expiries: ChainExpiry[],
  window: ExpiryWindow
): ChainExpiry[] {
  const now = Date.now();
  const future = expiries
    .filter((e) => new Date(e.expiryDate).getTime() >= now - 86_400_000)
    .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate));

  if (future.length === 0) return [];
  if (window === "all") return future;
  if (window === "front") return [future[0]];

  const days = window === "2w" ? 14 : 31; // "monthly" ≈ within a month
  const cutoff = now + days * 86_400_000;
  const within = future.filter((e) => new Date(e.expiryDate).getTime() <= cutoff);
  // Never return nothing if the nearest expiry is just past the cutoff.
  return within.length > 0 ? within : [future[0]];
}

async function fetchSpot(symbolId: number): Promise<number | null> {
  try {
    const data = await questradeGet<SymbolQuotesResponse>(
      `/v1/markets/quotes/${symbolId}`
    );
    return data.quotes[0]?.lastTradePrice ?? null;
  } catch {
    return null; // spot is a nicety (strike band); never fail the whole request
  }
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const windowParam = (request.nextUrl.searchParams.get("window") ??
    "2w") as ExpiryWindow;

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }
  if (!VALID_WINDOWS.includes(windowParam)) {
    return NextResponse.json(
      { error: `invalid window '${windowParam}'` },
      { status: 400 }
    );
  }

  const cacheKey = `${ticker.toUpperCase()}:${windowParam}`;
  const cached = questradeOptionsCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const symbolId = await resolveSymbolId(ticker);
    if (symbolId === null) {
      return NextResponse.json(
        { error: `No Questrade symbol found for '${ticker}'` },
        { status: 404 }
      );
    }

    const [chain, spot] = await Promise.all([
      questradeGet<OptionChainResponse>(`/v1/symbols/${symbolId}/options`),
      fetchSpot(symbolId),
    ]);

    const allExpiries = chain.optionChain ?? [];
    const expiries: OptionsExpiry[] = allExpiries
      .map((e) => expiryDay(e.expiryDate))
      .sort()
      .map((day) => ({ date: day, label: formatExpiryLabel(day) }));

    const selected = selectExpiries(allExpiries, windowParam);

    // Map each option contract id → the strike it belongs to and its side, so
    // we can fold the quote responses back into per-strike rows.
    const lo = spot ? spot * (1 - STRIKE_BAND) : -Infinity;
    const hi = spot ? spot * (1 + STRIKE_BAND) : Infinity;

    const strikeOf = new Map<number, number>(); // optionId → strike
    const sideOf = new Map<number, "call" | "put">(); // optionId → side
    const ids: number[] = [];

    for (const expiry of selected) {
      for (const root of expiry.chainPerRoot ?? []) {
        for (const s of root.chainPerStrikePrice ?? []) {
          if (s.strikePrice < lo || s.strikePrice > hi) continue;
          strikeOf.set(s.callSymbolId, s.strikePrice);
          sideOf.set(s.callSymbolId, "call");
          strikeOf.set(s.putSymbolId, s.strikePrice);
          sideOf.set(s.putSymbolId, "put");
          ids.push(s.callSymbolId, s.putSymbolId);
        }
      }
    }

    // Aggregate quotes into per-strike rows. Gamma×OI is summed separately per
    // side so we can derive net GEX once spot is known.
    const byStrike = new Map<number, OptionStrikeRow>();
    const gammaAcc = new Map<number, { call: number; put: number }>();
    let hasGreeks = false;

    for (const batch of chunk(ids, QUOTE_BATCH_SIZE)) {
      const { optionQuotes } = await questradePost<OptionQuotesResponse>(
        "/v1/markets/quotes/options",
        { optionIds: batch }
      );
      for (const q of optionQuotes) {
        const strike = strikeOf.get(q.symbolId);
        const side = sideOf.get(q.symbolId);
        if (strike === undefined || side === undefined) continue;

        let row = byStrike.get(strike);
        if (!row) {
          row = { strike, callOI: 0, putOI: 0, callVol: 0, putVol: 0, gex: 0 };
          byStrike.set(strike, row);
        }
        const oi = q.openInterest ?? 0;
        const vol = q.volume ?? 0;
        if (side === "call") {
          row.callOI += oi;
          row.callVol += vol;
        } else {
          row.putOI += oi;
          row.putVol += vol;
        }

        if (q.gamma != null) {
          hasGreeks = true;
          const g = gammaAcc.get(strike) ?? { call: 0, put: 0 };
          if (side === "call") g.call += q.gamma * oi;
          else g.put += q.gamma * oi;
          gammaAcc.set(strike, g);
        }
      }
    }

    const rows = [...byStrike.values()].sort((a, b) => a.strike - b.strike);

    // Net dealer GEX per strike (dollars hedged per 1% move): calls add, puts
    // subtract, scaled by spot²·0.01·contract-multiplier.
    const gexScale = spot != null ? spot * spot * 0.01 * 100 : 0;
    for (const r of rows) {
      const g = gammaAcc.get(r.strike);
      r.gex = g ? gexScale * (g.call - g.put) : 0;
    }
    const netGex = rows.reduce((sum, r) => sum + r.gex, 0);
    const flip = gexScale > 0 ? computeFlip(rows) : null;

    const payload: OptionsChainResponse = {
      rows,
      expiries,
      spot,
      asOf: new Date().toISOString(),
      hasGreeks,
      netGex,
      flip,
    };

    questradeOptionsCache.set(cacheKey, payload);
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Failed to fetch Questrade options for ${ticker}`, detail: message },
      { status: 500 }
    );
  }
}
