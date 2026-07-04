// Pure parser for the insider-trading table on a Finviz quote page
// (quote.ashx?t=XXX). No fetching here — keeps it trivially testable, mirroring
// src/lib/dataroma/stockActivity.ts.

/** Colour bucket for a transaction: buys green, proposed sales yellow, sales red. */
export type InsiderAction = "buy" | "proposed_sale" | "sale" | "other";

export interface InsiderTrade {
  /** Insider name, e.g. "LEVINSON ARTHUR D". */
  owner: string;
  /** Role, e.g. "Director" or "10% Owner". */
  relationship: string;
  /** Trade date as shown, e.g. "May 27 '26". */
  date: string;
  /** Raw Finviz label, e.g. "Sale", "Proposed Sale", "Buy", "Option Exercise". */
  transaction: string;
  /** buy/proposed_sale/sale bucket classified from the label. */
  action: InsiderAction;
  cost: number;
  shares: number;
  /** Value ($) of the transaction. */
  value: number;
  /** Insider's total holding after the trade (0 when Finviz leaves it blank). */
  sharesTotal: number;
  /** SEC Form 4 filing URL, or null if absent. */
  secFormUrl: string | null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Classify a Finviz transaction label into a colour bucket.
 * "Buy" → buy, "Proposed Sale" → proposed_sale, "Sale" → sale, anything else
 * (e.g. "Option Exercise") → other (rendered neutral).
 */
export function classifyTransaction(raw: string): InsiderAction {
  const t = raw.trim().toLowerCase();
  if (t === "buy") return "buy";
  if (t === "proposed sale") return "proposed_sale";
  if (t === "sale") return "sale";
  return "other";
}

/**
 * Parse a Finviz quote page into its recent insider transactions.
 * Rows carry the `fv-insider-row` class, which is unique to the insider table,
 * so we can match them directly without bounding the surrounding <table>.
 */
export function parseInsiderTrades(html: string): InsiderTrade[] {
  const trades: InsiderTrade[] = [];

  const rowRe = /<tr[^>]*class="[^"]*fv-insider-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const row = rowMatch[1];

    // Cells in order: Owner, Relationship, Date, Transaction, Cost, #Shares,
    // Value ($), #Shares Total, SEC Form 4.
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      stripTags(c[1]),
    );
    if (cells.length < 8) continue;

    const transaction = cells[3];
    // SEC Form 4 link lives in the final cell's <a href>.
    const secFormUrl =
      /href="(https?:\/\/[^"]*sec\.gov[^"]*)"/i.exec(row)?.[1] ?? null;

    trades.push({
      owner: cells[0],
      relationship: cells[1],
      date: cells[2],
      transaction,
      action: classifyTransaction(transaction),
      cost: toNumber(cells[4]),
      shares: Math.round(toNumber(cells[5])),
      value: Math.round(toNumber(cells[6])),
      sharesTotal: Math.round(toNumber(cells[7])),
      secFormUrl,
    });
  }

  return trades;
}
