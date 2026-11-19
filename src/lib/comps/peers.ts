import Anthropic from "@anthropic-ai/sdk";
import YahooFinance from "yahoo-finance2";
import { withTimeout } from "@/lib/apiHandler";
import { createServerSupabaseClient } from "@/lib/supabase";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface Peer {
  ticker: string;
  name: string;
  reason: string;
}

export type PeerSource = "claude" | "yahoo";

export interface PeerResult {
  ticker: string;
  peers: Peer[];
  source: PeerSource;
  /** True when the set came from Yahoo's "people also watch" fallback, not real competitors. */
  approximate: boolean;
  generatedAt: string;
}

export const MAX_PEERS = 10;
const CACHE_DAYS = 30;
const MODEL = "claude-sonnet-5-5";

// Flat schema: structured outputs reject nullable unions and require every prop.
export const PEER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["peers"],
  properties: {
    peers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ticker", "name", "reason"],
        properties: {
          ticker: { type: "string" },
          name: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You pick comparable public companies for a relative-valuation
(trading comps) screen, the way an equity analyst would.

Rules:
- Return 8 to 10 peers that compete with the target for the same customers
  and revenue, or that investors value on the same basis. Prefer direct
  business-model competitors over companies that only share a sector label.
- Only currently listed companies with liquid shares. Use the Yahoo Finance
  symbol: US listings as plain tickers (AMD), class shares with a dash (BRK-B),
  foreign primary listings with the Yahoo suffix (ASML.AS, 7203.T, SAP.DE),
  or the US ADR when one is the usual way investors hold it (TSM, ASML).
- Never include the target itself, and never include ETFs, indices or funds.
- "reason" is one short clause (under 15 words) naming the overlap, e.g.
  "GPU and data-center accelerator rival".
- Order by relevance, most comparable first.`;

/** Yahoo symbol form: upper case, class-share dots become dashes (BRK.B → BRK-B) but exchange suffixes stay. */
export function normalizeTicker(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  // A single-letter suffix after a dot on a US-style ticker is a share class.
  return /^[A-Z]{1,5}\.[A-Z]$/.test(t) ? t.replace(".", "-") : t;
}

/** Normalize, de-duplicate, drop the target and junk, cap the count. */
export function sanitizePeers(raw: Peer[], target: string): Peer[] {
  const seen = new Set<string>([normalizeTicker(target)]);
  const out: Peer[] = [];
  for (const p of raw) {
    const ticker = normalizeTicker(p.ticker ?? "");
    if (!ticker || !/^[A-Z0-9][A-Z0-9.\-^=]{0,14}$/.test(ticker) || seen.has(ticker)) continue;
    seen.add(ticker);
    out.push({ ticker, name: (p.name ?? "").trim() || ticker, reason: (p.reason ?? "").trim() });
    if (out.length >= MAX_PEERS) break;
  }
  return out;
}

interface QuoteLike {
  symbol?: string;
  quoteType?: string;
  regularMarketPrice?: number | null;
  longName?: string | null;
  shortName?: string | null;
}

/** Keep only peers Yahoo knows as a priced equity, and take Yahoo's name for them. */
export function keepListed(peers: Peer[], quotes: QuoteLike[]): Peer[] {
  const bySymbol = new Map(quotes.map((q) => [q.symbol?.toUpperCase(), q]));
  return peers.flatMap((p) => {
    const q = bySymbol.get(p.ticker);
    if (!q || q.quoteType !== "EQUITY" || q.regularMarketPrice == null) return [];
    return [{ ...p, name: q.longName ?? q.shortName ?? p.name }];
  });
}

async function validateListed(peers: Peer[]): Promise<Peer[]> {
  if (peers.length === 0) return [];
  const quotes = (await withTimeout(
    yf.quote(peers.map((p) => p.ticker), { return: "array" }),
    15_000,
    "peer quote validation"
  )) as QuoteLike[];
  return keepListed(peers, quotes);
}

async function askClaude(target: string, name: string, industry: string | null): Promise<Peer[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: { format: { type: "json_schema", schema: PEER_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Target: ${target} (${name})${industry ? `, Yahoo industry: ${industry}` : ""}.\nList its comparable companies.`,
      },
    ],
  });
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No text block in peer response");
  const parsed = JSON.parse(text.text) as { peers?: Peer[] };
  return Array.isArray(parsed.peers) ? parsed.peers : [];
}

async function yahooFallback(target: string): Promise<Peer[]> {
  const rec = await withTimeout(yf.recommendationsBySymbol(target), 10_000, "recommendationsBySymbol");
  const list = (Array.isArray(rec) ? rec[0] : rec)?.recommendedSymbols ?? [];
  return list.map((r: { symbol: string }) => ({ ticker: r.symbol, name: r.symbol, reason: "" }));
}

async function readCache(ticker: string): Promise<PeerResult | null> {
  try {
    const db = createServerSupabaseClient();
    const { data, error } = await db
      .from("comp_peers")
      .select("ticker, peers, source, created_at")
      .eq("ticker", ticker)
      .maybeSingle();
    if (error || !data) return null;
    const ageDays = (Date.now() - Date.parse(data.created_at)) / 86_400_000;
    if (ageDays > CACHE_DAYS) return null;
    return {
      ticker,
      peers: data.peers as Peer[],
      source: data.source as PeerSource,
      approximate: data.source !== "claude",
      generatedAt: data.created_at,
    };
  } catch {
    return null;
  }
}

async function writeCache(result: PeerResult): Promise<void> {
  try {
    const db = createServerSupabaseClient();
    await db.from("comp_peers").upsert({
      ticker: result.ticker,
      peers: result.peers,
      source: result.source,
      created_at: result.generatedAt,
    });
  } catch (err) {
    console.warn("[comps/peers] cache write failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Suggested peers for a ticker: the 30-day Supabase cache, else Claude
 * (validated against Yahoo), else Yahoo's similar-symbols list flagged
 * approximate. Only Claude results are cached, so a fallback set is retried
 * on the next request.
 */
export async function getPeers(
  rawTicker: string,
  context: { name: string; industry: string | null },
  { refresh = false }: { refresh?: boolean } = {}
): Promise<PeerResult> {
  const ticker = normalizeTicker(rawTicker);
  if (!refresh) {
    const cached = await readCache(ticker);
    if (cached) return cached;
  }

  try {
    const suggested = sanitizePeers(await askClaude(ticker, context.name, context.industry), ticker);
    const peers = await validateListed(suggested);
    if (peers.length > 0) {
      const result: PeerResult = {
        ticker,
        peers,
        source: "claude",
        approximate: false,
        generatedAt: new Date().toISOString(),
      };
      await writeCache(result);
      return result;
    }
  } catch (err) {
    console.warn(`[comps/peers] claude peers failed for ${ticker}:`, err instanceof Error ? err.message : err);
  }

  let peers: Peer[] = [];
  try {
    peers = await validateListed(sanitizePeers(await yahooFallback(ticker), ticker));
  } catch (err) {
    console.warn(`[comps/peers] yahoo fallback failed for ${ticker}:`, err instanceof Error ? err.message : err);
  }
  return { ticker, peers, source: "yahoo", approximate: true, generatedAt: new Date().toISOString() };
}
