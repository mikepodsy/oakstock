// Encode/decode a position into URL query params so it's bookmarkable and
// shareable. Each leg is one `leg=` param, dot-joined:
//   leg=<action>.<type>.<strike>.<qty>.<expiry>
// e.g. leg=buy.call.100.1.2026-07-17
import type { OptionLeg, OptionAction, LegInstrument } from "@/types/options";

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function encodeLeg(l: OptionLeg): string {
  return [l.action, l.type, l.strike ?? "", l.qty, l.expiry ?? ""].join(".");
}

// Returns a query string fragment (no leading "?"), one `leg` param per leg.
export function encodeLegs(legs: OptionLeg[]): string {
  const params = new URLSearchParams();
  for (const l of legs) params.append("leg", encodeLeg(l));
  return params.toString();
}

const ACTIONS: OptionAction[] = ["buy", "sell"];
const TYPES: LegInstrument[] = ["call", "put", "stock"];

function parseLeg(raw: string): OptionLeg | null {
  const parts = raw.split(".");
  if (parts.length < 5) return null;
  const [action, type, strikeStr, qtyStr, ...expiryParts] = parts;
  const expiry = expiryParts.join(".") || null; // dates have no dots, but be safe
  const strike = Number(strikeStr);
  const qty = Number(qtyStr);
  if (!ACTIONS.includes(action as OptionAction)) return null;
  if (!TYPES.includes(type as LegInstrument)) return null;
  if (!Number.isFinite(strike) || !Number.isFinite(qty) || qty <= 0) return null;
  return {
    id: randomId(),
    action: action as OptionAction,
    type: type as LegInstrument,
    qty,
    strike: strike || null,
    expiry,
    mid: null,
    iv: null,
    ivOverride: null,
    greeks: null,
  };
}

export function decodeLegs(params: URLSearchParams): OptionLeg[] {
  const out: OptionLeg[] = [];
  for (const raw of params.getAll("leg")) {
    const leg = parseLeg(raw);
    if (leg) out.push(leg);
  }
  return out;
}
